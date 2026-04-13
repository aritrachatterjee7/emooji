-- eMooJI PostGIS Database Schema
-- Run this on a fresh PostgreSQL + PostGIS instance (Phase 2)
--
-- Requirements: PostgreSQL 14+ with PostGIS 3.x extension
-- On Render: create a PostgreSQL service, connect, run this file.

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ---------------------------------------------------------------------------
-- Farms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farms (
    id           SERIAL PRIMARY KEY,
    farm_name    TEXT NOT NULL,
    customer_id  TEXT UNIQUE NOT NULL,
    region       TEXT,          -- e.g. "Hesse", "Aberdeenshire", "Catalonia"
    country      TEXT,          -- e.g. "DE", "GB", "ES"
    contact_name TEXT,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE farms IS 'One row per participating farm in the eMooJI pilot';

-- ---------------------------------------------------------------------------
-- Paddocks (farm parcels / fields)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paddocks (
    id               SERIAL PRIMARY KEY,
    farm_id          INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    paddock_name     TEXT NOT NULL,
    boundary         GEOGRAPHY(POLYGON, 4326) NOT NULL,
    area_m2          FLOAT,
    area_ha          FLOAT GENERATED ALWAYS AS (area_m2 / 10000.0) STORED,
    last_grazed_date DATE,
    land_use         TEXT,   -- e.g. "permanent_pasture", "arable", "mixed"
    tags             JSONB DEFAULT '{}',
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paddocks_boundary
    ON paddocks USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_paddocks_farm_id
    ON paddocks(farm_id);

COMMENT ON TABLE paddocks IS 'Farm paddocks / parcels with spatial boundaries';

-- ---------------------------------------------------------------------------
-- Animals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animals (
    id           SERIAL PRIMARY KEY,
    farm_id      INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    animal_id    TEXT UNIQUE NOT NULL,  -- unique animal tag / ear tag
    collar_id    TEXT,                  -- GPS collar serial number
    species      TEXT DEFAULT 'cattle',
    breed        TEXT,
    sex          TEXT,                  -- M / F / unknown
    date_of_birth DATE,
    weight_kg    FLOAT,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animals_farm_id
    ON animals(farm_id);

COMMENT ON TABLE animals IS 'Registered livestock with GPS collar assignments';

-- ---------------------------------------------------------------------------
-- GPS Positions (time series — can be large)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    id            BIGSERIAL PRIMARY KEY,
    animal_id     TEXT NOT NULL REFERENCES animals(animal_id) ON DELETE CASCADE,
    location      GEOGRAPHY(POINTZ, 4326) NOT NULL,
    recorded_at   TIMESTAMPTZ NOT NULL,
    battery_level FLOAT,   -- collar battery %
    accuracy_m    FLOAT,   -- GPS accuracy in metres
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_animal_time
    ON positions(animal_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_location
    ON positions USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_positions_recorded_at
    ON positions(recorded_at DESC);

COMMENT ON TABLE positions IS 'GPS collar position pings — time series';

-- ---------------------------------------------------------------------------
-- NDVI Readings (per paddock, per date)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ndvi_readings (
    id            SERIAL PRIMARY KEY,
    paddock_id    INTEGER REFERENCES paddocks(id) ON DELETE CASCADE,
    reading_date  DATE NOT NULL,
    ndvi_mean     FLOAT NOT NULL,
    ndvi_min      FLOAT,
    ndvi_max      FLOAT,
    cloud_cover   FLOAT,       -- % cloud cover on acquisition date
    source        TEXT DEFAULT 'sentinel-2',
    scene_id      TEXT,        -- Copernicus scene identifier
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paddock_id, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_ndvi_paddock_date
    ON ndvi_readings(paddock_id, reading_date DESC);

COMMENT ON TABLE ndvi_readings IS 'Sentinel-2 NDVI readings per paddock';

-- ---------------------------------------------------------------------------
-- Grazing Events (optional — for richer rotation management)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grazing_events (
    id             SERIAL PRIMARY KEY,
    paddock_id     INTEGER REFERENCES paddocks(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE,
    animal_count   INTEGER,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grazing_paddock
    ON grazing_events(paddock_id, start_date DESC);

COMMENT ON TABLE grazing_events IS 'Historical grazing rotation records';

-- ---------------------------------------------------------------------------
-- Helpful views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_paddock_latest_ndvi AS
SELECT
    p.id               AS paddock_id,
    p.paddock_name,
    p.farm_id,
    p.last_grazed_date,
    p.area_ha,
    nr.reading_date    AS latest_ndvi_date,
    nr.ndvi_mean,
    nr.ndvi_min,
    nr.ndvi_max,
    CASE
        WHEN nr.ndvi_mean > 0.6 THEN 'excellent'
        WHEN nr.ndvi_mean > 0.4 THEN 'good'
        WHEN nr.ndvi_mean > 0.2 THEN 'moderate'
        ELSE 'poor'
    END AS ndvi_class,
    NOW()::date - p.last_grazed_date AS days_since_grazed
FROM paddocks p
LEFT JOIN LATERAL (
    SELECT *
    FROM ndvi_readings nr2
    WHERE nr2.paddock_id = p.id
    ORDER BY nr2.reading_date DESC
    LIMIT 1
) nr ON true;

COMMENT ON VIEW v_paddock_latest_ndvi IS
    'Latest NDVI reading per paddock with classification and days since grazing';

CREATE OR REPLACE VIEW v_animal_latest_position AS
SELECT DISTINCT ON (a.animal_id)
    a.animal_id,
    a.farm_id,
    a.species,
    a.collar_id,
    p.recorded_at,
    ST_X(p.location::geometry) AS longitude,
    ST_Y(p.location::geometry) AS latitude,
    ST_Z(p.location::geometry) AS altitude_m,
    p.battery_level
FROM animals a
LEFT JOIN positions p ON a.animal_id = p.animal_id
ORDER BY a.animal_id, p.recorded_at DESC;

COMMENT ON VIEW v_animal_latest_position IS
    'Most recent GPS position for each animal';
