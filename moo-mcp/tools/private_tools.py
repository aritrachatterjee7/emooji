"""
private_tools.py — Mode 1 tools backed by PostGIS database (eMooJI pilot).

These tools require farm data to be loaded into the PostgreSQL/PostGIS database.
They will return a helpful message if no database is configured.
Full implementation in Phase 2 when the DB service is connected.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)


def _db_available() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


def _no_db_response(tool_name: str) -> str:
    return json.dumps({
        "error": "Database not connected",
        "tool": tool_name,
        "message": (
            "This tool requires Mode 1 (private farm data). "
            "No database is currently configured. "
            "To use this feature, connect a PostGIS database via the DATABASE_URL environment variable "
            "and load your farm data using the moo-db schema."
        ),
        "mode": "Mode 1 — requires farm data",
    })


def get_my_paddocks_impl(customer_id: str) -> str:
    """
    Retrieve all paddock boundaries and metadata for a farm (Mode 1).
    Requires farm data in the PostGIS database.

    Args:
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON with all paddock GeoJSON boundaries, names, areas, and last-grazed dates.
    """
    if not _db_available():
        return _no_db_response("get_my_paddocks")
    # Full implementation in Phase 2
    return _no_db_response("get_my_paddocks")


def get_paddock_rating_impl(paddock_name: str, customer_id: str) -> str:
    """
    Get the current NDVI-based vegetation rating for a named paddock (Mode 1).

    Args:
        paddock_name: Name of the paddock.
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON with rating (good/moderate/bad), ndvi_mean, and last reading date.
    """
    if not _db_available():
        return _no_db_response("get_paddock_rating")
    return _no_db_response("get_paddock_rating")


def get_animals_in_paddock_impl(paddock_name: str, customer_id: str) -> str:
    """
    Find which animals are currently located inside a named paddock (Mode 1).
    Uses ST_Intersects between latest animal GPS positions and paddock boundary.

    Args:
        paddock_name: Name of the paddock.
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON list of animal IDs and species currently inside the paddock.
    """
    if not _db_available():
        return _no_db_response("get_animals_in_paddock")
    return _no_db_response("get_animals_in_paddock")


def get_animal_track_impl(animal_id: str, hours: int = 24) -> str:
    """
    Retrieve the GPS movement track for an animal over the past N hours (Mode 1).

    Args:
        animal_id: Unique animal identifier (collar ID or tag).
        hours: Number of hours to look back (default 24, max 168).

    Returns:
        JSON with GeoJSON LineString of the animal's movement path and timestamps.
    """
    if not _db_available():
        return _no_db_response("get_animal_track")
    return _no_db_response("get_animal_track")


def get_ungrazed_paddocks_impl(days: int = 30, customer_id: str = "") -> str:
    """
    Find paddocks that have not been grazed for more than N days (Mode 1).

    Args:
        days: Minimum number of days since last grazing (default 30).
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON list of paddocks with their last_grazed_date and days since grazing.
    """
    if not _db_available():
        return _no_db_response("get_ungrazed_paddocks")
    return _no_db_response("get_ungrazed_paddocks")


def get_low_ndvi_paddocks_impl(threshold: float = 0.35, customer_id: str = "") -> str:
    """
    Find paddocks whose most recent NDVI reading is below a threshold (Mode 1).

    Args:
        threshold: NDVI threshold value (default 0.35 — below this = poor vegetation).
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON list of paddocks with ndvi_mean below threshold and their last reading date.
    """
    if not _db_available():
        return _no_db_response("get_low_ndvi_paddocks")
    return _no_db_response("get_low_ndvi_paddocks")


def recommend_paddock_for_herd_move_impl(customer_id: str) -> str:
    """
    Recommend the best paddock(s) to move the herd to next (Mode 1).

    Combines: highest NDVI + longest since last grazed + no animals currently inside.
    Returns a ranked list of paddocks with scoring rationale.

    Args:
        customer_id: The farm's unique customer identifier.

    Returns:
        JSON ranked list of paddocks with scores and recommendation reasoning.
    """
    if not _db_available():
        return _no_db_response("recommend_paddock_for_herd_move")
    return _no_db_response("recommend_paddock_for_herd_move")
