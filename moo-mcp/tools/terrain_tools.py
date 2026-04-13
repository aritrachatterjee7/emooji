"""
terrain_tools.py — Elevation and slope analysis using Open-Elevation API.

API docs: https://open-elevation.com/
No API key required. Public free service.
"""

import json
import logging
import math

import httpx

logger = logging.getLogger(__name__)

OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"


def _parse_polygon(geojson_str: str) -> dict:
    data = json.loads(geojson_str)
    if data.get("type") == "Feature":
        data = data["geometry"]
    if data.get("type") != "Polygon":
        raise ValueError(f"Expected Polygon geometry, got {data.get('type')}")
    return data


def _classify_slope(slope_deg: float) -> str:
    if slope_deg < 3:
        return "flat"
    elif slope_deg < 8:
        return "gentle"
    elif slope_deg < 15:
        return "moderate"
    else:
        return "steep"


def _slope_grazing_suitability(slope_deg: float) -> str:
    if slope_deg < 8:
        return "excellent"
    elif slope_deg < 15:
        return "good"
    elif slope_deg < 25:
        return "marginal"
    else:
        return "unsuitable"


def _sample_polygon_points(polygon: dict, max_points: int = 20) -> list[dict]:
    """
    Sample points from within a polygon for elevation queries.
    Uses the boundary vertices + centroid + internal grid.
    """
    coords = polygon["coordinates"][0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    points = []

    # Boundary vertices (skip duplicate close point)
    for c in coords[:-1]:
        points.append({"latitude": round(c[1], 6), "longitude": round(c[0], 6)})

    # Centroid
    cx = sum(lons) / len(lons)
    cy = sum(lats) / len(lats)
    points.append({"latitude": round(cy, 6), "longitude": round(cx, 6)})

    # Internal grid sample
    grid_steps = 3
    for i in range(grid_steps):
        for j in range(grid_steps):
            glon = min_lon + (max_lon - min_lon) * (i + 0.5) / grid_steps
            glat = min_lat + (max_lat - min_lat) * (j + 0.5) / grid_steps
            points.append({"latitude": round(glat, 6), "longitude": round(glon, 6)})

    # Deduplicate and cap
    seen = set()
    unique = []
    for p in points:
        key = (p["latitude"], p["longitude"])
        if key not in seen:
            seen.add(key)
            unique.append(p)
            if len(unique) >= max_points:
                break

    return unique


def _fetch_elevations(points: list[dict]) -> list[float | None]:
    """Fetch elevation in metres for a batch of lat/lon points."""
    try:
        resp = httpx.post(
            OPEN_ELEVATION_URL,
            json={"locations": points},
            timeout=20,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return [r.get("elevation") for r in results]
    except Exception as exc:
        logger.warning("Open-Elevation API failed: %s", exc)
        return []


def _estimate_slope_degrees(elevations: list[float], points: list[dict]) -> float:
    """
    Estimate mean slope in degrees from point elevations.
    Uses the max elevation difference between adjacent sampled points
    divided by horizontal distance as a proxy for gradient.
    """
    if len(elevations) < 2:
        return 0.0

    n = min(len(elevations), len(points))
    valid = [(elevations[i], points[i]) for i in range(n) if elevations[i] is not None]
    if len(valid) < 2:
        return 0.0

    max_slope = 0.0
    for i in range(len(valid)):
        for j in range(i + 1, len(valid)):
            elev_diff = abs(valid[i][0] - valid[j][0])
            p1, p2 = valid[i][1], valid[j][1]
            # Approx horizontal distance in metres (1 deg lat ≈ 111000 m)
            dlat = (p1["latitude"] - p2["latitude"]) * 111000
            dlon = (p1["longitude"] - p2["longitude"]) * 111000 * math.cos(
                math.radians((p1["latitude"] + p2["latitude"]) / 2)
            )
            horiz = math.sqrt(dlat**2 + dlon**2)
            if horiz > 0:
                slope = math.degrees(math.atan(elev_diff / horiz))
                if slope > max_slope:
                    max_slope = slope

    # Return mean of max slope and a moderate estimate
    return round((max_slope + max_slope * 0.4) / 2, 2)


def get_terrain_info_impl(geojson_polygon: str) -> str:
    """
    Analyse elevation and slope for a polygon to assess grazing terrain suitability.

    Queries Open-Elevation for multiple sample points within and on the boundary
    of the polygon. Returns average elevation, min/max elevation, estimated slope,
    and a suitability classification for livestock grazing.

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with elevation statistics, slope_degrees, slope_class
        (flat/gentle/moderate/steep), grazing_suitability, and a summary.
    """
    try:
        polygon = _parse_polygon(geojson_polygon)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        return json.dumps({"error": f"Invalid GeoJSON polygon: {exc}"})

    points = _sample_polygon_points(polygon, max_points=20)
    elevations_raw = _fetch_elevations(points)

    if not elevations_raw:
        return json.dumps({
            "error": "Elevation data unavailable. Open-Elevation API may be temporarily overloaded.",
            "advice": "Retry in a few minutes or check https://open-elevation.com status.",
        })

    elevations = [e for e in elevations_raw if e is not None]
    if not elevations:
        return json.dumps({"error": "No valid elevation values returned for this area."})

    elev_mean = round(sum(elevations) / len(elevations), 1)
    elev_min = round(min(elevations), 1)
    elev_max = round(max(elevations), 1)
    elev_range = round(elev_max - elev_min, 1)

    slope_deg = _estimate_slope_degrees(elevations_raw, points)
    slope_class = _classify_slope(slope_deg)
    grazing_suit = _slope_grazing_suitability(slope_deg)

    # Elevation-based notes
    notes = []
    if elev_mean > 800:
        notes.append("High altitude — shorter growing season and increased exposure to weather.")
    if elev_range > 50:
        notes.append("Significant elevation variation — terrain is undulating or hilly.")
    if slope_class in ("moderate", "steep"):
        notes.append("Slope may cause uneven grazing and increased soil erosion risk.")

    result = {
        "elevation_m": {
            "mean": elev_mean,
            "min": elev_min,
            "max": elev_max,
            "range": elev_range,
        },
        "slope_degrees": slope_deg,
        "slope_class": slope_class,
        "grazing_suitability": grazing_suit,
        "notes": notes,
        "sample_points_used": len(elevations),
        "data_source": "Open-Elevation (SRTM 90m)",
        "summary": (
            f"Terrain: {slope_class} slope ({slope_deg:.1f}°), "
            f"mean elevation {elev_mean} m (range {elev_min}–{elev_max} m). "
            f"Grazing suitability: {grazing_suit.upper()}. "
            + (" ".join(notes) if notes else "No terrain concerns.")
        ),
    }
    return json.dumps(result, indent=2)
