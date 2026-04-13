"""
server.py — eMooJI MCP Server for the JackDaw GeoAI validation pilot.

Deployed on Render via Docker. Exposes all public (Mode 2) and private (Mode 1)
tools via the MCP SSE transport.

Environment variables:
    PORT                      — set by Render automatically
    COPERNICUS_CLIENT_ID      — from https://dataspace.copernicus.eu/
    COPERNICUS_CLIENT_SECRET  — from https://dataspace.copernicus.eu/
    DATABASE_URL              — PostgreSQL connection string (Mode 1, optional)

Transport: SSE (Server-Sent Events)
Framework: FastMCP (mcp==1.27.0)
"""

import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

load_dotenv() 



# Tool implementation functions
from tools.ndvi_tools import get_ndvi_for_area_impl, get_ndvi_trend_impl
from tools.weather_tools import get_weather_and_heat_stress_impl
from tools.natura_tools import check_natura2000_overlap_impl
from tools.terrain_tools import get_terrain_info_impl
from tools.landcover_tools import get_land_cover_impl
from tools.grazing_tools import get_erosion_risk_impl, get_grazing_suitability_impl
from tools.private_tools import (
    get_my_paddocks_impl,
    get_paddock_rating_impl,
    get_animals_in_paddock_impl,
    get_animal_track_impl,
    get_ungrazed_paddocks_impl,
    get_low_ndvi_paddocks_impl,
    recommend_paddock_for_herd_move_impl,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastMCP setup — keep exactly the same pattern as the existing working server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    name="moofind-emoo-ji-mcp",
    host="0.0.0.0",
    port=int(os.environ.get("PORT", 8000)),
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    stateless_http=True,
)

# ---------------------------------------------------------------------------
# Legacy tool — keep working as-is for JackDaw compatibility
# ---------------------------------------------------------------------------

GEOJSON_PATH = Path(__file__).parent / "lichtwiese.geojson"


@mcp.tool()
def get_land_info(name: str) -> str:
    """
    Returns GeoJSON boundary data for named demo land parcels: Land A, Land B, or Land C.
    These are the Lichtwiese demo paddocks for the eMooJI pilot validation.
    Use this to retrieve the polygon boundary for a named parcel before running analysis tools.

    Args:
        name: Parcel name — one of "Land A", "Land B", or "Land C".
    """
    try:
        with open(GEOJSON_PATH) as f:
            data = json.load(f)
        features = data.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            if props.get("name", "").strip().lower() == name.strip().lower():
                return json.dumps(feat)
        available = [f.get("properties", {}).get("name", "") for f in features]
        return json.dumps({"error": f"'{name}' not found. Available: {available}"})
    except FileNotFoundError:
        return json.dumps({"error": "lichtwiese.geojson not found on server."})
    except Exception as exc:
        logger.exception("get_land_info error")
        return json.dumps({"error": str(exc)})


# ---------------------------------------------------------------------------
# PUBLIC TOOLS — Mode 2 (no farm data required, works for any European polygon)
# ---------------------------------------------------------------------------


@mcp.tool()
def get_ndvi_for_area(geojson_polygon: str) -> str:
    """
    Fetch current vegetation health (NDVI) for any field or farm area in Europe.

    Uses Copernicus Sentinel-2 satellite imagery to compute NDVI statistics.
    Classifies vegetation health as: excellent (>0.6), good (0.4–0.6),
    moderate (0.2–0.4), or poor (<0.2).

    Use this when a farmer asks:
    - "What is the vegetation health of this field?"
    - "Show me vegetation health and grazing suitability for this area"
    - "Which grazing areas have high vegetation this week?"

    Args:
        geojson_polygon: GeoJSON string of the area to analyse.
                         Must be a Polygon or Feature containing a Polygon.
                         Coordinates in WGS84 (EPSG:4326).

    Returns:
        JSON with ndvi_mean, ndvi_min, ndvi_max, classification, acquisition_date,
        and a human-readable summary.
    """
    logger.info("Tool called: get_ndvi_for_area")
    return get_ndvi_for_area_impl(geojson_polygon)


@mcp.tool()
def get_ndvi_trend(geojson_polygon: str, months: int = 6) -> str:
    """
    Analyse how pasture productivity has changed over the past N months using Sentinel-2 NDVI.

    Returns monthly NDVI values and classifies the overall trend as improving,
    stable, or declining.

    Use this when a farmer asks:
    - "How has pasture productivity changed over the past two seasons?"
    - "Show me the NDVI trend for this field over 6 months"
    - "Has this area improved or declined since last year?"

    Args:
        geojson_polygon: GeoJSON string of the area to analyse (Polygon or Feature).
        months: Number of past months to analyse. Default 6. Maximum 24.

    Returns:
        JSON with monthly time_series (date + NDVI), overall trend direction,
        and a summary narrative.
    """
    logger.info("Tool called: get_ndvi_trend (months=%s)", months)
    return get_ndvi_trend_impl(geojson_polygon, months)


@mcp.tool()
def get_weather_and_heat_stress(geojson_polygon: str) -> str:
    """
    Fetch weather data and assess livestock heat stress risk for an area.

    Returns 7-day historical weather (temperature, rainfall, humidity) and
    3-day forecast. Classifies heat stress risk for cattle as low, medium, or high
    based on temperature thresholds (medium ≥30°C, high ≥35°C).

    Use this when a farmer asks:
    - "Which pastures are most vulnerable to heat stress this week?"
    - "What is the weather forecast for this field?"
    - "Has there been enough rain this week for good grass growth?"
    - "Should I move my herd due to heat risk?"

    Args:
        geojson_polygon: GeoJSON string of the area (Polygon or Feature).
                         The centroid is used for the weather query.

    Returns:
        JSON with history_7d, forecast_3d, heat_stress (past and forecast),
        total_rainfall_7d_mm, and farmer advice.
    """
    logger.info("Tool called: get_weather_and_heat_stress")
    return get_weather_and_heat_stress_impl(geojson_polygon)


@mcp.tool()
def check_natura2000_overlap(geojson_polygon: str) -> str:
    """
    Check whether a drawn polygon overlaps with any Natura 2000 protected area.

    Queries the European Environment Agency's Natura 2000 spatial database.
    Returns YES/NO, site names, site types (SPA = bird protection, SAC = habitat),
    and regulatory notes if an overlap is found.

    Use this when a farmer asks:
    - "Which parcels overlap with Natura 2000 zones?"
    - "Is this field inside a protected area?"
    - "Are there any environmental restrictions on this land?"
    - "Can I intensify farming here without an environmental assessment?"

    Args:
        geojson_polygon: GeoJSON string of the area to check (Polygon or Feature).

    Returns:
        JSON with overlaps_natura2000 (bool), list of sites (name, type, area_ha),
        and a regulatory note if applicable.
    """
    logger.info("Tool called: check_natura2000_overlap")
    return check_natura2000_overlap_impl(geojson_polygon)


@mcp.tool()
def get_terrain_info(geojson_polygon: str) -> str:
    """
    Analyse elevation and slope for a polygon to assess grazing terrain suitability.

    Uses Open-Elevation (SRTM 90m) to sample multiple points within the polygon.
    Returns mean/min/max elevation, estimated slope, and grazing suitability
    classification: excellent (<8°), good (8–15°), marginal (15–25°), unsuitable (>25°).

    Use this when a farmer asks:
    - "What is the slope of this field?"
    - "Is this terrain suitable for grazing?"
    - "Show me slope suitability for grazing in this area"
    - "How steep is this hillside?"

    Args:
        geojson_polygon: GeoJSON string of the area to analyse (Polygon or Feature).

    Returns:
        JSON with elevation_m (mean/min/max/range), slope_degrees, slope_class,
        grazing_suitability, and terrain notes.
    """
    logger.info("Tool called: get_terrain_info")
    return get_terrain_info_impl(geojson_polygon)


@mcp.tool()
def get_land_cover(geojson_polygon: str) -> str:
    """
    Identify the land cover type(s) within a polygon using CORINE Land Cover 2018.

    Returns dominant land cover class (pasture, arable, forest, grassland, urban,
    wetland, etc.) and whether the area is compatible with livestock grazing.

    Use this when a farmer asks:
    - "What type of land is this?"
    - "Is this registered as pasture or arable land?"
    - "What is the official land classification for this area?"

    Args:
        geojson_polygon: GeoJSON string of the area to classify (Polygon or Feature).

    Returns:
        JSON with dominant_class (CORINE code + label + category), all land cover
        classes found, and grazing compatibility percentage.
    """
    logger.info("Tool called: get_land_cover")
    return get_land_cover_impl(geojson_polygon)


@mcp.tool()
def get_erosion_risk(geojson_polygon: str) -> str:
    """
    Assess soil erosion risk by combining recent rainfall intensity and terrain slope.

    Uses a simplified erosion model:
    - Rainfall erosivity from OpenMeteo (7-day total)
    - Slope steepness from Open-Elevation (SRTM)
    Classifies risk as low, medium, or high with management recommendations.

    Use this when a farmer asks:
    - "Find areas with highest erosion risk after last week's rainfall"
    - "Is this field at risk of soil erosion?"
    - "Where should I avoid heavy machinery after recent rain?"
    - "Which areas need erosion protection measures?"

    Args:
        geojson_polygon: GeoJSON string of the area to assess (Polygon or Feature).

    Returns:
        JSON with erosion_risk (low/medium/high), rainfall_7d_mm, slope_degrees,
        and prioritised management recommendations.
    """
    logger.info("Tool called: get_erosion_risk")
    return get_erosion_risk_impl(geojson_polygon)


@mcp.tool()
def get_grazing_suitability(geojson_polygon: str) -> str:
    """
    Comprehensive grazing suitability assessment combining all available data sources.

    This is the master suitability tool. Synthesises:
    - Vegetation health (NDVI from Copernicus Sentinel-2)
    - Terrain suitability (slope and elevation from Open-Elevation)
    - Weather and heat stress risk (OpenMeteo forecast)
    - Land cover type (CORINE 2018)

    Returns overall suitability: suitable, marginal, or unsuitable,
    with a 0–100 composite score, component breakdown, and limiting factors.

    Use this when a farmer asks:
    - "Which parts of the farm are most suitable for moving the herd tomorrow?"
    - "Show vegetation health and slope suitability for grazing in my field"
    - "Which grazing areas are ready for the herd this week?"
    - "Give me a complete assessment of this paddock for grazing"

    Args:
        geojson_polygon: GeoJSON string of the area to assess (Polygon or Feature).

    Returns:
        JSON with overall_suitability, score (0-100), score_breakdown by component,
        limiting_factors list, and a narrative summary.
    """
    logger.info("Tool called: get_grazing_suitability")
    return get_grazing_suitability_impl(geojson_polygon)


# ---------------------------------------------------------------------------
# PRIVATE TOOLS — Mode 1 (requires farm data in PostGIS database)
# ---------------------------------------------------------------------------


@mcp.tool()
def get_my_paddocks(customer_id: str) -> str:
    """
    Retrieve all paddock boundaries and metadata for a registered farm (Mode 1).

    Requires farm data loaded into the eMooJI database. Returns paddock names,
    boundary polygons (GeoJSON), area in hectares, and last grazing date.

    Use this when a farmer with registered data asks:
    - "Show me all my paddocks"
    - "List my farm's fields"
    - "What paddocks do I have?"

    Args:
        customer_id: Unique farm/customer identifier assigned during registration.

    Returns:
        JSON list of paddocks with GeoJSON boundaries, area_ha, last_grazed_date.
    """
    logger.info("Tool called: get_my_paddocks (customer_id=%s)", customer_id)
    return get_my_paddocks_impl(customer_id)


@mcp.tool()
def get_paddock_rating(paddock_name: str, customer_id: str) -> str:
    """
    Get the current vegetation rating for a named paddock based on NDVI history (Mode 1).

    Args:
        paddock_name: Name of the paddock as registered in the farm database.
        customer_id: Unique farm/customer identifier.

    Returns:
        JSON with rating (good/moderate/bad), ndvi_mean, and last reading date.
    """
    logger.info("Tool called: get_paddock_rating (%s, %s)", paddock_name, customer_id)
    return get_paddock_rating_impl(paddock_name, customer_id)


@mcp.tool()
def get_animals_in_paddock(paddock_name: str, customer_id: str) -> str:
    """
    Find which animals are currently located inside a named paddock using GPS collar data (Mode 1).

    Performs spatial query: ST_Intersects between latest animal positions and paddock boundary.

    Args:
        paddock_name: Name of the paddock.
        customer_id: Unique farm/customer identifier.

    Returns:
        JSON list of animal IDs and species currently inside the paddock boundary.
    """
    logger.info("Tool called: get_animals_in_paddock (%s, %s)", paddock_name, customer_id)
    return get_animals_in_paddock_impl(paddock_name, customer_id)


@mcp.tool()
def get_animal_track(animal_id: str, hours: int = 24) -> str:
    """
    Retrieve the GPS movement track for a collared animal over the past N hours (Mode 1).

    Returns a GeoJSON LineString showing the animal's path, with timestamps at each point.

    Args:
        animal_id: Unique animal identifier (GPS collar ID or ear tag number).
        hours: Number of hours of track history to return (default 24, max 168 = 7 days).

    Returns:
        JSON with GeoJSON LineString geometry, timestamps, and total distance estimate.
    """
    logger.info("Tool called: get_animal_track (%s, %s hours)", animal_id, hours)
    return get_animal_track_impl(animal_id, hours)


@mcp.tool()
def get_ungrazed_paddocks(days: int = 30, customer_id: str = "") -> str:
    """
    Find paddocks that have not been grazed for more than a specified number of days (Mode 1).

    Useful for identifying paddocks that may have accumulated excess growth and
    are ready (or overdue) for grazing rotation.

    Use this when a farmer asks:
    - "Which paddocks have not been grazed for more than 30 days?"
    - "Which fields are overdue for grazing?"
    - "Show me paddocks that need to be grazed soon"

    Args:
        days: Minimum number of days since last grazing event (default 30).
        customer_id: Unique farm/customer identifier.

    Returns:
        JSON list of paddocks with last_grazed_date and days_since_grazed.
    """
    logger.info("Tool called: get_ungrazed_paddocks (days=%s, customer=%s)", days, customer_id)
    return get_ungrazed_paddocks_impl(days, customer_id)


@mcp.tool()
def get_low_ndvi_paddocks(threshold: float = 0.35, customer_id: str = "") -> str:
    """
    Find registered paddocks whose most recent Sentinel-2 NDVI reading is below a threshold (Mode 1).

    Identifies paddocks with poor vegetation that may need rest, reseeding, or
    reduced grazing pressure.

    Use this when a farmer asks:
    - "Which permanent pastures have NDVI values below 0.35 this month?"
    - "Which of my fields have poor grass growth?"
    - "Show me paddocks with low vegetation this season"

    Args:
        threshold: NDVI threshold. Paddocks below this value are returned.
                   Default 0.35 — below this is considered poor vegetation health.
        customer_id: Unique farm/customer identifier.

    Returns:
        JSON list of paddocks with ndvi_mean, last_reading_date, classified below threshold.
    """
    logger.info("Tool called: get_low_ndvi_paddocks (threshold=%s, customer=%s)", threshold, customer_id)
    return get_low_ndvi_paddocks_impl(threshold, customer_id)


@mcp.tool()
def recommend_paddock_for_herd_move(customer_id: str) -> str:
    """
    Recommend the best paddock(s) to move the herd to next, based on multiple criteria (Mode 1).

    Scoring combines:
    - Highest recent NDVI (best vegetation growth)
    - Longest time since last grazing (most rested)
    - No animals currently inside (available)

    Use this when a farmer asks:
    - "Which paddock should I move my herd to next?"
    - "Which parts of the farm are most suitable for moving the herd tomorrow?"
    - "Recommend the best paddock for grazing rotation"

    Args:
        customer_id: Unique farm/customer identifier.

    Returns:
        JSON ranked list of paddocks with composite scores and recommendation rationale.
    """
    logger.info("Tool called: recommend_paddock_for_herd_move (customer=%s)", customer_id)
    return recommend_paddock_for_herd_move_impl(customer_id)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info("Starting eMooJI MCP server on port %s", port)

    sse_app = mcp.sse_app()
    cors_app = CORSMiddleware(
        sse_app,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    uvicorn.run(cors_app, host="0.0.0.0", port=port)
