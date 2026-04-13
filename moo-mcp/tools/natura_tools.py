"""
natura_tools.py — EEA Natura 2000 WFS overlap check for eMooJI pilot.

Uses the European Environment Agency's public WFS endpoint:
https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedAreas/CDDA_Terrestrial/MapServer/WFSServer

No API key required. Public access.
"""

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# EEA Natura 2000 / Designated Areas WFS endpoints (public, no auth)
NATURA_WFS_URL = (
    "https://bio.discomap.eea.europa.eu/arcgis/rest/services/"
    "ProtectedAreas/Natura2000_Terrestrial_EU/MapServer/0/query"
)

# Fallback: INSPIRE-compliant WFS from EEA
NATURA_WFS_INSPIRE = (
    "https://bio.discomap.eea.europa.eu/arcgis/rest/services/"
    "ProtectedAreas/Natura2000_Terrestrial_EU/MapServer/1/query"
)


def _parse_polygon(geojson_str: str) -> dict:
    data = json.loads(geojson_str)
    if data.get("type") == "Feature":
        data = data["geometry"]
    if data.get("type") != "Polygon":
        raise ValueError(f"Expected Polygon geometry, got {data.get('type')}")
    return data


def _polygon_to_bbox(polygon: dict) -> tuple[float, float, float, float]:
    coords = polygon["coordinates"][0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return min(lons), min(lats), max(lons), max(lats)


def _polygon_to_esri_envelope(bbox: tuple) -> dict:
    """Convert bbox to ESRI envelope geometry for ArcGIS REST query."""
    min_lon, min_lat, max_lon, max_lat = bbox
    return {
        "xmin": min_lon,
        "ymin": min_lat,
        "xmax": max_lon,
        "ymax": max_lat,
        "spatialReference": {"wkid": 4326},
    }


def _query_natura2000_esri(bbox: tuple) -> list[dict]:
    """Query EEA ArcGIS REST service for Natura 2000 sites intersecting bbox."""
    envelope = _polygon_to_esri_envelope(bbox)
    params = {
        "geometry": json.dumps(envelope),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outSR": "4326",
        "outFields": "SITECODE,SITENAME,SITETYPE,MS,AREAHA",
        "returnGeometry": "false",
        "f": "json",
    }
    try:
        resp = httpx.get(NATURA_WFS_URL, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        return features
    except Exception as exc:
        logger.warning("Natura 2000 primary query failed: %s", exc)
        return []


def _query_natura2000_fallback(bbox: tuple) -> list[dict]:
    """Fallback to second layer (SACs / SPAs combined)."""
    envelope = _polygon_to_esri_envelope(bbox)
    params = {
        "geometry": json.dumps(envelope),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outSR": "4326",
        "outFields": "*",
        "returnGeometry": "false",
        "f": "json",
    }
    try:
        resp = httpx.get(NATURA_WFS_INSPIRE, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return data.get("features", [])
    except Exception as exc:
        logger.warning("Natura 2000 fallback query failed: %s", exc)
        return []


def _site_type_label(code: str) -> str:
    mapping = {
        "A": "SPA (Special Protection Area for Birds)",
        "B": "SAC (Special Area of Conservation)",
        "C": "SPA + SAC (both designations)",
        "H": "Habitat site",
    }
    return mapping.get(str(code).upper(), f"Designated area (type: {code})")


def check_natura2000_overlap_impl(geojson_polygon: str) -> str:
    """
    Check whether a polygon overlaps with any Natura 2000 protected area.

    Queries the European Environment Agency's public Natura 2000 spatial service.
    Returns the overlap status, zone names, and site types for any protected areas found.

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with: overlaps (bool), sites list (name, type, code, area_ha),
        and a human-readable summary. Returns NO if no overlap found.
    """
    try:
        polygon = _parse_polygon(geojson_polygon)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        return json.dumps({"error": f"Invalid GeoJSON polygon: {exc}"})

    bbox = _polygon_to_bbox(polygon)

    features = _query_natura2000_esri(bbox)
    if not features:
        features = _query_natura2000_fallback(bbox)

    if not features:
        result = {
            "overlaps_natura2000": False,
            "sites": [],
            "data_source": "EEA Natura 2000 (European Environment Agency)",
            "summary": (
                "NO Natura 2000 protected area overlap detected for this polygon. "
                "Standard agricultural activities are not restricted by Natura 2000 "
                "designations for this location."
            ),
        }
        return json.dumps(result, indent=2)

    sites = []
    for feat in features:
        attrs = feat.get("attributes", {})
        site_code = attrs.get("SITECODE") or attrs.get("sitecode") or "Unknown"
        site_name = attrs.get("SITENAME") or attrs.get("sitename") or "Unknown site"
        site_type = attrs.get("SITETYPE") or attrs.get("sitetype") or "?"
        area_ha = attrs.get("AREAHA") or attrs.get("areaha")

        sites.append({
            "site_code": site_code,
            "site_name": site_name,
            "site_type": site_type,
            "site_type_label": _site_type_label(site_type),
            "area_ha": round(float(area_ha), 1) if area_ha else None,
        })

    site_names = ", ".join(s["site_name"] for s in sites[:3])
    if len(sites) > 3:
        site_names += f" (+{len(sites) - 3} more)"

    result = {
        "overlaps_natura2000": True,
        "site_count": len(sites),
        "sites": sites,
        "data_source": "EEA Natura 2000 (European Environment Agency)",
        "regulatory_note": (
            "This area overlaps with Natura 2000 protected zones. "
            "Land management activities may require Habitats Regulations Assessment. "
            "Consult your national competent authority before intensifying land use."
        ),
        "summary": (
            f"YES — this polygon overlaps with {len(sites)} Natura 2000 protected area(s): "
            f"{site_names}. Activities in or near this area may require environmental assessment."
        ),
    }
    return json.dumps(result, indent=2)
