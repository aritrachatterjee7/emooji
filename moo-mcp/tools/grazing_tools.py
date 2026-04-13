"""
grazing_tools.py — Erosion risk and combined grazing suitability for eMooJI pilot.

Erosion risk combines rainfall intensity (OpenMeteo) + slope (Open-Elevation).
Grazing suitability is the master tool combining NDVI + terrain + weather + land cover.
"""

import json
import logging

from tools.ndvi_tools import get_ndvi_for_area_impl
from tools.weather_tools import get_weather_and_heat_stress_impl
from tools.terrain_tools import get_terrain_info_impl
from tools.landcover_tools import get_land_cover_impl

logger = logging.getLogger(__name__)


def _safe_parse(result_str: str) -> dict:
    """Parse a JSON result string, returning an empty dict on failure."""
    try:
        return json.loads(result_str)
    except Exception:
        return {}


def get_erosion_risk_impl(geojson_polygon: str) -> str:
    """
    Assess erosion risk for a polygon by combining rainfall data and terrain slope.

    Erosion risk is calculated using a simplified RUSLE-inspired model:
    - Rainfall erosivity: total 7-day rainfall and intensity
    - Slope factor: slope gradient from Open-Elevation
    - Classifies erosion risk as low, medium, or high

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with erosion_risk (low/medium/high), contributing factors,
        slope_degrees, rainfall_7d_mm, and management recommendations.
    """
    # Fetch rainfall data
    weather_result = _safe_parse(get_weather_and_heat_stress_impl(geojson_polygon))
    terrain_result = _safe_parse(get_terrain_info_impl(geojson_polygon))

    if "error" in weather_result and "error" in terrain_result:
        return json.dumps({
            "error": "Could not fetch weather or terrain data for erosion assessment.",
            "weather_error": weather_result.get("error"),
            "terrain_error": terrain_result.get("error"),
        })

    rainfall_7d = weather_result.get("total_rainfall_7d_mm", 0) or 0
    slope_deg = terrain_result.get("slope_degrees", 0) or 0
    slope_class = terrain_result.get("slope_class", "unknown")

    # Erosion risk matrix
    # Rainfall thresholds: low <20mm, medium 20-50mm, high >50mm
    # Slope thresholds: flat<3°, gentle<8°, moderate<15°, steep≥15°
    if rainfall_7d > 50 and slope_deg >= 15:
        risk = "high"
    elif rainfall_7d > 50 and slope_deg >= 8:
        risk = "high"
    elif rainfall_7d > 30 and slope_deg >= 15:
        risk = "high"
    elif rainfall_7d > 30 and slope_deg >= 8:
        risk = "medium"
    elif rainfall_7d > 20 and slope_deg >= 15:
        risk = "medium"
    elif rainfall_7d > 50:
        risk = "medium"
    elif slope_deg >= 15:
        risk = "medium"
    else:
        risk = "low"

    recommendations = {
        "high": [
            "Avoid heavy machinery on wet slopes.",
            "Remove livestock from steep areas immediately to reduce compaction.",
            "Consider grass buffer strips along watercourses.",
            "Check drainage ditches and remove blockages.",
        ],
        "medium": [
            "Monitor soil structure on sloped areas.",
            "Limit grazing intensity on steeper terrain during wet spells.",
            "Maintain adequate vegetation cover to anchor soil.",
        ],
        "low": [
            "Conditions favour stable soil. Routine monitoring recommended.",
        ],
    }

    result = {
        "erosion_risk": risk,
        "contributing_factors": {
            "rainfall_7d_mm": round(rainfall_7d, 1),
            "slope_degrees": slope_deg,
            "slope_class": slope_class,
        },
        "elevation_data": terrain_result.get("elevation_m", {}),
        "recommendations": recommendations[risk],
        "data_sources": [
            "Open-Meteo (ERA5 rainfall)",
            "Open-Elevation (SRTM slope)",
        ],
        "summary": (
            f"Erosion risk: {risk.upper()}. "
            f"Rainfall past 7 days: {rainfall_7d:.1f} mm, "
            f"terrain slope: {slope_class} ({slope_deg:.1f}°). "
            + recommendations[risk][0]
        ),
    }
    return json.dumps(result, indent=2)


def get_grazing_suitability_impl(geojson_polygon: str) -> str:
    """
    Assess overall grazing suitability for a polygon by combining NDVI,
    terrain, weather, and land cover data.

    This is the master suitability tool. It synthesises all available signals:
    - Vegetation health (NDVI from Sentinel-2)
    - Slope and elevation (Open-Elevation)
    - Weather and heat stress (OpenMeteo)
    - Land cover type (CORINE)
    And returns an overall verdict: suitable, marginal, or unsuitable.

    Use this when a farmer asks: "Which areas are suitable for moving the herd
    tomorrow?" or "Which parts of the farm are ready for grazing?"

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with overall_suitability, score (0-100), component scores,
        limiting_factors, and a prioritised recommendation.
    """
    # Gather all signals
    ndvi_result = _safe_parse(get_ndvi_for_area_impl(geojson_polygon))
    terrain_result = _safe_parse(get_terrain_info_impl(geojson_polygon))
    weather_result = _safe_parse(get_weather_and_heat_stress_impl(geojson_polygon))
    landcover_result = _safe_parse(get_land_cover_impl(geojson_polygon))

    # --- NDVI score (0–40 points) ---
    ndvi_class = ndvi_result.get("classification", "unknown")
    ndvi_mean = ndvi_result.get("ndvi_mean", 0) or 0
    ndvi_score_map = {"excellent": 40, "good": 32, "moderate": 20, "poor": 5}
    ndvi_score = ndvi_score_map.get(ndvi_class, 10)

    # --- Terrain score (0–30 points) ---
    terrain_suit = terrain_result.get("grazing_suitability", "unknown")
    terrain_score_map = {"excellent": 30, "good": 24, "marginal": 12, "unsuitable": 0, "unknown": 15}
    terrain_score = terrain_score_map.get(terrain_suit, 15)

    # --- Weather/heat stress score (0–20 points) ---
    heat_stress = (weather_result.get("heat_stress") or {}).get("next_3d", "low")
    weather_score_map = {"low": 20, "medium": 12, "high": 4, "unknown": 15}
    weather_score = weather_score_map.get(heat_stress, 15)

    # --- Land cover score (0–10 points) ---
    dominant = landcover_result.get("dominant_class") or {}
    is_grazing_land = dominant.get("grazing_compatible", True)  # default True if unknown
    landcover_score = 10 if is_grazing_land else 3

    total_score = ndvi_score + terrain_score + weather_score + landcover_score

    # Overall verdict
    if total_score >= 75:
        suitability = "suitable"
    elif total_score >= 45:
        suitability = "marginal"
    else:
        suitability = "unsuitable"

    # Limiting factors
    limiting = []
    if ndvi_class in ("poor", "moderate"):
        limiting.append(f"Low vegetation density (NDVI {ndvi_mean:.2f}, classified as {ndvi_class})")
    if terrain_suit in ("marginal", "unsuitable"):
        limiting.append(f"Challenging terrain ({terrain_result.get('slope_class', 'unknown')} slope, {terrain_result.get('slope_degrees', 0):.1f}°)")
    if heat_stress in ("medium", "high"):
        limiting.append(f"Heat stress risk is {heat_stress} over the next 3 days")
    if not is_grazing_land:
        limiting.append(f"Land cover type ({dominant.get('label', 'unknown')}) not typical grazing land")

    if not limiting:
        limiting.append("No significant limiting factors identified")

    result = {
        "overall_suitability": suitability,
        "score": total_score,
        "score_breakdown": {
            "ndvi_vegetation": {"score": ndvi_score, "max": 40, "classification": ndvi_class, "ndvi_mean": round(ndvi_mean, 3)},
            "terrain": {"score": terrain_score, "max": 30, "suitability": terrain_suit},
            "weather_heat_stress": {"score": weather_score, "max": 20, "heat_stress": heat_stress},
            "land_cover": {"score": landcover_score, "max": 10, "grazing_compatible": is_grazing_land, "type": dominant.get("label", "unknown")},
        },
        "limiting_factors": limiting,
        "data_sources": [
            "Copernicus Sentinel-2 (NDVI)",
            "Open-Elevation (SRTM terrain)",
            "Open-Meteo (weather forecast)",
            "CORINE Land Cover 2018 (EEA)",
        ],
        "summary": (
            f"Overall grazing suitability: {suitability.upper()} (score {total_score}/100). "
            f"NDVI: {ndvi_class}, terrain: {terrain_suit}, heat stress: {heat_stress}. "
            + (f"Key constraint: {limiting[0]}" if limiting and limiting[0] != "No significant limiting factors identified" else "No significant constraints.")
        ),
    }
    return json.dumps(result, indent=2)
