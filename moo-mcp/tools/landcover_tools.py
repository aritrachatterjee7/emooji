"""
landcover_tools.py — CORINE Land Cover via Copernicus Land Service WCS/WMS.

Copernicus Land Service CORINE 2018 is freely available via WMS/WCS.
Endpoint: https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer

No API key required for the public ArcGIS REST service.
"""

import json
import logging

import httpx

logger = logging.getLogger(__name__)

# EEA ArcGIS REST service for CORINE Land Cover 2018
CORINE_IDENTIFY_URL = (
    "https://image.discomap.eea.europa.eu/arcgis/rest/services/"
    "Corine/CLC2018_WM/MapServer/0/query"
)

# CORINE land cover class codes → human-readable labels
CORINE_CLASSES = {
    # Urban
    "111": ("Continuous urban fabric", "urban"),
    "112": ("Discontinuous urban fabric", "urban"),
    "121": ("Industrial or commercial units", "industrial"),
    "122": ("Road and rail networks", "transport"),
    "131": ("Mineral extraction sites", "mining"),
    "141": ("Green urban areas", "green_urban"),
    "142": ("Sport and leisure facilities", "leisure"),
    # Agricultural
    "211": ("Non-irrigated arable land", "arable"),
    "212": ("Permanently irrigated land", "arable_irrigated"),
    "213": ("Rice fields", "rice"),
    "221": ("Vineyards", "vineyard"),
    "222": ("Fruit trees and berry plantations", "orchard"),
    "231": ("Pastures", "pasture"),
    "241": ("Annual crops with permanent crops", "mixed_crops"),
    "242": ("Complex cultivation patterns", "mixed_crops"),
    "243": ("Agriculture with natural vegetation", "agri_natural"),
    "244": ("Agro-forestry areas", "agro_forestry"),
    # Forest and semi-natural
    "311": ("Broad-leaved forest", "forest_broadleaf"),
    "312": ("Coniferous forest", "forest_conifer"),
    "313": ("Mixed forest", "forest_mixed"),
    "321": ("Natural grasslands", "grassland"),
    "322": ("Moors and heathland", "heathland"),
    "323": ("Sclerophyllous vegetation", "shrubland"),
    "324": ("Transitional woodland-shrub", "woodland_shrub"),
    "331": ("Beaches, dunes, sands", "bare_sand"),
    "332": ("Bare rocks", "bare_rock"),
    "333": ("Sparsely vegetated areas", "sparse_vegetation"),
    "334": ("Burnt areas", "burnt"),
    "335": ("Glaciers and perpetual snow", "glacier"),
    # Wetlands
    "411": ("Inland marshes", "wetland_inland"),
    "412": ("Peat bogs", "peatbog"),
    "421": ("Salt marshes", "salt_marsh"),
    "422": ("Salines", "saline"),
    # Water
    "511": ("Water courses", "water_river"),
    "512": ("Water bodies", "water_lake"),
    "521": ("Coastal lagoons", "lagoon"),
    "522": ("Estuaries", "estuary"),
    "523": ("Sea and ocean", "sea"),
}

# Which CORINE classes are considered suitable for grazing
GRAZING_SUITABLE_TYPES = {
    "pasture", "grassland", "heathland", "agri_natural", "agro_forestry",
    "mixed_crops", "woodland_shrub", "sparse_vegetation"
}


def _parse_polygon(geojson_str: str) -> dict:
    data = json.loads(geojson_str)
    if data.get("type") == "Feature":
        data = data["geometry"]
    if data.get("type") != "Polygon":
        raise ValueError(f"Expected Polygon, got {data.get('type')}")
    return data


def _polygon_to_bbox(polygon: dict) -> tuple:
    coords = polygon["coordinates"][0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return min(lons), min(lats), max(lons), max(lats)


def _polygon_centroid(polygon: dict) -> tuple:
    coords = polygon["coordinates"][0]
    return (
        sum(c[0] for c in coords) / len(coords),
        sum(c[1] for c in coords) / len(coords),
    )


def _query_corine_esri(bbox: tuple) -> list[dict]:
    """Query EEA ArcGIS REST for CORINE classes intersecting the bbox."""
    min_lon, min_lat, max_lon, max_lat = bbox
    envelope = json.dumps({
        "xmin": min_lon, "ymin": min_lat,
        "xmax": max_lon, "ymax": max_lat,
        "spatialReference": {"wkid": 4326},
    })
    params = {
        "geometry": envelope,
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outSR": "4326",
        "outFields": "Code_18,Remark,Shape_Area",
        "returnGeometry": "false",
        "f": "json",
    }
    try:
        resp = httpx.get(CORINE_IDENTIFY_URL, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json().get("features", [])
    except Exception as exc:
        logger.warning("CORINE query failed: %s", exc)
        return []


def _parse_corine_features(features: list[dict]) -> list[dict]:
    classes = []
    total_area = 0.0
    for feat in features:
        attrs = feat.get("attributes", {})
        code = str(attrs.get("Code_18", "")).strip()
        area = float(attrs.get("Shape_Area", 0) or 0)
        total_area += area
        label, category = CORINE_CLASSES.get(code, (f"CORINE class {code}", "unknown"))
        classes.append({
            "corine_code": code,
            "label": label,
            "category": category,
            "area_m2": round(area),
            "grazing_compatible": category in GRAZING_SUITABLE_TYPES,
        })

    # Sort by area descending
    classes.sort(key=lambda x: x["area_m2"], reverse=True)

    # Add percentage
    if total_area > 0:
        for c in classes:
            c["area_pct"] = round(100 * c["area_m2"] / total_area, 1)

    return classes


def get_land_cover_impl(geojson_polygon: str) -> str:
    """
    Identify the land cover type(s) within a polygon using CORINE Land Cover 2018.

    Queries the Copernicus Land Service / EEA to classify land use:
    pasture, arable, forest, grassland, urban, wetland, etc.
    Indicates whether each class is compatible with livestock grazing.

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with dominant_class, all land cover classes found,
        grazing compatibility, and a human-readable summary.
    """
    try:
        polygon = _parse_polygon(geojson_polygon)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        return json.dumps({"error": f"Invalid GeoJSON polygon: {exc}"})

    bbox = _polygon_to_bbox(polygon)
    features = _query_corine_esri(bbox)

    if not features:
        # Fall back: centroid point identify
        lon, lat = _polygon_centroid(polygon)
        point_params = {
            "geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "inSR": "4326",
            "outSR": "4326",
            "outFields": "Code_18,Remark,Shape_Area",
            "returnGeometry": "false",
            "f": "json",
        }
        try:
            resp = httpx.get(CORINE_IDENTIFY_URL, params=point_params, timeout=15)
            resp.raise_for_status()
            features = resp.json().get("features", [])
        except Exception as exc:
            logger.warning("CORINE centroid fallback failed: %s", exc)

    if not features:
        return json.dumps({
            "error": "No CORINE land cover data found for this area.",
            "note": "CORINE covers EU territory. Non-EU areas are not covered.",
            "data_source": "Copernicus CORINE Land Cover 2018 (EEA)",
        })

    classes = _parse_corine_features(features)
    dominant = classes[0] if classes else None

    grazing_pct = sum(c["area_pct"] for c in classes if c.get("grazing_compatible") and "area_pct" in c)

    result = {
        "dominant_class": dominant,
        "all_classes": classes,
        "grazing_compatible_area_pct": round(grazing_pct, 1),
        "data_source": "Copernicus CORINE Land Cover 2018 (EEA)",
        "summary": (
            f"Dominant land cover: {dominant['label']} (CORINE {dominant['corine_code']}). "
            f"{'This area is suitable for grazing.' if dominant['grazing_compatible'] else 'This area type is not typically used for grazing.'} "
            f"{round(grazing_pct, 0):.0f}% of the area is grazing-compatible land."
        ) if dominant else "No land cover data available.",
    }
    return json.dumps(result, indent=2)
