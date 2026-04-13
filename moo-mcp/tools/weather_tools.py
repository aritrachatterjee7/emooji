"""
weather_tools.py — OpenMeteo weather + heat stress tools for eMooJI pilot.

OpenMeteo is free and requires no API key.
Docs: https://open-meteo.com/en/docs
"""

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"
OPENMETEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Heat stress thresholds for livestock (cattle)
HEAT_STRESS_LOW = 25.0     # °C — below this: no heat stress
HEAT_STRESS_MEDIUM = 30.0  # °C — medium
HEAT_STRESS_HIGH = 35.0    # °C — high


def _parse_polygon(geojson_str: str) -> dict:
    data = json.loads(geojson_str)
    if data.get("type") == "Feature":
        data = data["geometry"]
    if data.get("type") != "Polygon":
        raise ValueError(f"Expected Polygon geometry, got {data.get('type')}")
    return data


def _polygon_centroid(polygon: dict) -> tuple[float, float]:
    coords = polygon["coordinates"][0]
    lon = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return lon, lat


def _classify_heat_stress(max_temp: float) -> str:
    if max_temp >= HEAT_STRESS_HIGH:
        return "high"
    elif max_temp >= HEAT_STRESS_MEDIUM:
        return "medium"
    else:
        return "low"


def _classify_heat_stress_from_series(temps: list[float]) -> str:
    if not temps:
        return "unknown"
    peak = max(temps)
    return _classify_heat_stress(peak)


def get_weather_and_heat_stress_impl(geojson_polygon: str) -> str:
    """
    Fetch weather data and assess heat stress risk for the area covered by the polygon.

    Retrieves: 7-day historical temperature and rainfall, 3-day forecast,
    and classifies heat stress risk for livestock (cattle) as low, medium, or high.

    Args:
        geojson_polygon: GeoJSON string of a Polygon or Feature(Polygon).

    Returns:
        JSON string with historical weather, forecast, heat_stress_level,
        and a human-readable summary suitable for farmer decision-making.
    """
    try:
        polygon = _parse_polygon(geojson_polygon)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        return json.dumps({"error": f"Invalid GeoJSON polygon: {exc}"})

    lon, lat = _polygon_centroid(polygon)

    today = datetime.now(timezone.utc).date()
    history_start = (today - timedelta(days=7)).isoformat()
    forecast_end = (today + timedelta(days=3)).isoformat()

    params = {
        "latitude": round(lat, 5),
        "longitude": round(lon, 5),
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "relative_humidity_2m_max",
            "windspeed_10m_max",
        ],
        "start_date": history_start,
        "end_date": forecast_end,
        "timezone": "auto",
    }

    try:
        resp = httpx.get(OPENMETEO_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as exc:
        return json.dumps({"error": f"OpenMeteo API error {exc.response.status_code}: {exc.response.text}"})
    except Exception as exc:
        return json.dumps({"error": f"Weather data fetch failed: {exc}"})

    daily = data.get("daily", {})
    dates = daily.get("time", [])
    temp_max = daily.get("temperature_2m_max", [])
    temp_min = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_sum", [])
    humidity = daily.get("relative_humidity_2m_max", [])
    wind = daily.get("windspeed_10m_max", [])

    # Split into history vs forecast
    today_str = today.isoformat()
    history = []
    forecast = []

    for i, d in enumerate(dates):
        entry = {
            "date": d,
            "temp_max_c": temp_max[i] if i < len(temp_max) else None,
            "temp_min_c": temp_min[i] if i < len(temp_min) else None,
            "precipitation_mm": precip[i] if i < len(precip) else None,
            "humidity_max_pct": humidity[i] if i < len(humidity) else None,
            "windspeed_max_kmh": wind[i] if i < len(wind) else None,
        }
        if d <= today_str:
            history.append(entry)
        else:
            forecast.append(entry)

    # Heat stress assessment
    hist_temps = [e["temp_max_c"] for e in history if e["temp_max_c"] is not None]
    fcst_temps = [e["temp_max_c"] for e in forecast if e["temp_max_c"] is not None]
    all_temps = hist_temps + fcst_temps

    past_heat_stress = _classify_heat_stress_from_series(hist_temps)
    forecast_heat_stress = _classify_heat_stress_from_series(fcst_temps)

    total_rainfall_7d = sum(
        e["precipitation_mm"] for e in history if e["precipitation_mm"] is not None
    )

    # Narrative heat stress advice
    if forecast_heat_stress == "high":
        advice = (
            "HIGH heat stress risk forecast. Ensure shade and water access. "
            "Consider moving livestock to more sheltered paddocks."
        )
    elif forecast_heat_stress == "medium":
        advice = (
            "MEDIUM heat stress risk forecast. Monitor livestock closely. "
            "Ensure adequate water. Avoid intensive management during hottest hours."
        )
    else:
        advice = "LOW heat stress risk. Conditions are comfortable for livestock."

    result = {
        "location": {"latitude": round(lat, 5), "longitude": round(lon, 5)},
        "timezone": data.get("timezone", "auto"),
        "history_7d": history,
        "forecast_3d": forecast,
        "heat_stress": {
            "past_7d": past_heat_stress,
            "next_3d": forecast_heat_stress,
            "peak_temp_c": round(max(all_temps), 1) if all_temps else None,
        },
        "total_rainfall_7d_mm": round(total_rainfall_7d, 1),
        "advice": advice,
        "data_source": "Open-Meteo (ERA5 + ECMWF forecast)",
        "summary": (
            f"Heat stress risk for this area: {forecast_heat_stress.upper()} over the next 3 days. "
            f"Total rainfall past 7 days: {total_rainfall_7d:.1f} mm. {advice}"
        ),
    }
    return json.dumps(result, indent=2)
