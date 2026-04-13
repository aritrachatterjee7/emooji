-- eMooJI Seed Data — Lichtwiese Demo Farm + Three Pilot Regions
-- Run AFTER schema.sql
--
-- Seeds demo farms for: Hesse (DE), Aberdeenshire (GB), Catalonia (ES)
-- Plus Lichtwiese paddocks (Land A, B, C) as the primary demo.

-- ---------------------------------------------------------------------------
-- Demo farms — one per pilot region
-- ---------------------------------------------------------------------------
INSERT INTO farms (farm_name, customer_id, region, country, contact_name, notes)
VALUES
    ('Lichtwiese Demo Farm',      'demo-lichtwiese',    'Hesse',          'DE', 'Demo User',       'Primary eMooJI validation demo farm — Darmstadt area'),
    ('Aberdeenshire Pilot Farm',  'pilot-aberdeenshire','Aberdeenshire',   'GB', 'Pilot Farmer AB', 'PoliRuralPlus pilot site — Aberdeenshire, Scotland'),
    ('Finca Pilot Catalonia',     'pilot-catalonia',    'Catalonia',       'ES', 'Pilot Farmer CA', 'PoliRuralPlus pilot site — Catalonia, Spain')
ON CONFLICT (customer_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Lichtwiese paddocks (Land A, B, C) — Darmstadt area, Germany
-- Coordinates match lichtwiese.geojson
-- ---------------------------------------------------------------------------
INSERT INTO paddocks (farm_id, paddock_name, boundary, area_m2, last_grazed_date, land_use, tags, notes)
SELECT
    f.id,
    'Land A',
    ST_GeogFromText('SRID=4326;POLYGON((8.6612 49.8741, 8.6648 49.8741, 8.6648 49.8765, 8.6612 49.8765, 8.6612 49.8741))'),
    42000,
    '2025-11-15',
    'permanent_pasture',
    '{"type": "grassland", "soil": "loam", "slope": "gentle"}',
    'Northern pasture — gently sloping, good drainage'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT DO NOTHING;

INSERT INTO paddocks (farm_id, paddock_name, boundary, area_m2, last_grazed_date, land_use, tags, notes)
SELECT
    f.id,
    'Land B',
    ST_GeogFromText('SRID=4326;POLYGON((8.6655 49.8720, 8.6701 49.8720, 8.6701 49.8748, 8.6655 49.8748, 8.6655 49.8720))'),
    61000,
    '2025-10-28',
    'permanent_pasture',
    '{"type": "meadow", "soil": "clay_loam", "slope": "flat"}',
    'Central meadow — flat, high-quality permanent pasture'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT DO NOTHING;

INSERT INTO paddocks (farm_id, paddock_name, boundary, area_m2, last_grazed_date, land_use, tags, notes)
SELECT
    f.id,
    'Land C',
    ST_GeogFromText('SRID=4326;POLYGON((8.6620 49.8695, 8.6660 49.8695, 8.6660 49.8718, 8.6620 49.8718, 8.6620 49.8695))'),
    38000,
    '2025-09-05',
    'mixed',
    '{"type": "mixed", "soil": "sandy_loam", "slope": "gentle"}',
    'Southern field — mixed arable and grassland edge'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo animals for Lichtwiese farm
-- ---------------------------------------------------------------------------
INSERT INTO animals (farm_id, animal_id, collar_id, species, breed, sex, date_of_birth, notes)
SELECT
    f.id, 'UK123456', 'COLLAR-001', 'cattle', 'Holstein Friesian', 'F', '2020-03-15',
    'Lead cow, reliable GPS signal'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT (animal_id) DO NOTHING;

INSERT INTO animals (farm_id, animal_id, collar_id, species, breed, sex, date_of_birth, notes)
SELECT
    f.id, 'UK123457', 'COLLAR-002', 'cattle', 'Holstein Friesian', 'F', '2021-05-20',
    'Second cow in rotation'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT (animal_id) DO NOTHING;

INSERT INTO animals (farm_id, animal_id, collar_id, species, breed, sex, date_of_birth, notes)
SELECT
    f.id, 'UK123458', 'COLLAR-003', 'cattle', 'Angus cross', 'M', '2022-01-10',
    'Young bull — monitored for ranging behaviour'
FROM farms f WHERE f.customer_id = 'demo-lichtwiese'
ON CONFLICT (animal_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo GPS positions — animals in Land B (the large central paddock)
-- ---------------------------------------------------------------------------
INSERT INTO positions (animal_id, location, recorded_at, battery_level, accuracy_m)
VALUES
    ('UK123456',
     ST_GeogFromText('SRID=4326;POINTZ(8.6675 49.8732 145.0)'),
     NOW() - INTERVAL '1 hour', 78.5, 3.2),
    ('UK123456',
     ST_GeogFromText('SRID=4326;POINTZ(8.6678 49.8735 145.2)'),
     NOW() - INTERVAL '30 minutes', 78.2, 2.9),
    ('UK123456',
     ST_GeogFromText('SRID=4326;POINTZ(8.6680 49.8733 145.1)'),
     NOW() - INTERVAL '5 minutes', 78.0, 3.0),

    ('UK123457',
     ST_GeogFromText('SRID=4326;POINTZ(8.6668 49.8728 144.8)'),
     NOW() - INTERVAL '1 hour', 91.0, 4.1),
    ('UK123457',
     ST_GeogFromText('SRID=4326;POINTZ(8.6670 49.8730 145.0)'),
     NOW() - INTERVAL '30 minutes', 90.8, 3.8),
    ('UK123457',
     ST_GeogFromText('SRID=4326;POINTZ(8.6672 49.8731 145.0)'),
     NOW() - INTERVAL '5 minutes', 90.5, 3.5),

    ('UK123458',
     ST_GeogFromText('SRID=4326;POINTZ(8.6690 49.8740 146.0)'),
     NOW() - INTERVAL '1 hour', 55.3, 5.0),
    ('UK123458',
     ST_GeogFromText('SRID=4326;POINTZ(8.6685 49.8738 145.8)'),
     NOW() - INTERVAL '30 minutes', 55.0, 4.5),
    ('UK123458',
     ST_GeogFromText('SRID=4326;POINTZ(8.6682 49.8736 145.7)'),
     NOW() - INTERVAL '5 minutes', 54.8, 4.2)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Demo NDVI readings for Lichtwiese paddocks (last 6 months)
-- ---------------------------------------------------------------------------
-- Land A
INSERT INTO ndvi_readings (paddock_id, reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover, source)
SELECT p.id,
       d.reading_date::date,
       d.ndvi_mean, d.ndvi_min, d.ndvi_max, d.cloud_cover,
       'sentinel-2'
FROM paddocks p
CROSS JOIN (VALUES
    ('2025-06-15', 0.68, 0.55, 0.79, 5.2),
    ('2025-07-15', 0.72, 0.60, 0.82, 8.1),
    ('2025-08-15', 0.65, 0.51, 0.77, 12.4),
    ('2025-09-15', 0.58, 0.44, 0.70, 18.3),
    ('2025-10-15', 0.49, 0.38, 0.61, 22.0),
    ('2025-11-15', 0.41, 0.30, 0.53, 31.5),
    ('2025-12-15', 0.32, 0.22, 0.44, 45.0),
    ('2026-01-15', 0.28, 0.18, 0.40, 52.3),
    ('2026-02-15', 0.31, 0.21, 0.43, 38.1),
    ('2026-03-15', 0.42, 0.32, 0.54, 25.6)
) AS d(reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover)
WHERE p.paddock_name = 'Land A'
  AND p.farm_id = (SELECT id FROM farms WHERE customer_id = 'demo-lichtwiese')
ON CONFLICT (paddock_id, reading_date) DO NOTHING;

-- Land B
INSERT INTO ndvi_readings (paddock_id, reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover, source)
SELECT p.id,
       d.reading_date::date,
       d.ndvi_mean, d.ndvi_min, d.ndvi_max, d.cloud_cover,
       'sentinel-2'
FROM paddocks p
CROSS JOIN (VALUES
    ('2025-06-15', 0.74, 0.62, 0.85, 5.2),
    ('2025-07-15', 0.78, 0.65, 0.88, 8.1),
    ('2025-08-15', 0.70, 0.58, 0.81, 12.4),
    ('2025-09-15', 0.63, 0.50, 0.75, 18.3),
    ('2025-10-15', 0.52, 0.40, 0.65, 22.0),
    ('2025-11-15', 0.44, 0.33, 0.57, 31.5),
    ('2025-12-15', 0.33, 0.23, 0.45, 45.0),
    ('2026-01-15', 0.27, 0.17, 0.39, 52.3),
    ('2026-02-15', 0.30, 0.20, 0.42, 38.1),
    ('2026-03-15', 0.45, 0.35, 0.57, 25.6)
) AS d(reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover)
WHERE p.paddock_name = 'Land B'
  AND p.farm_id = (SELECT id FROM farms WHERE customer_id = 'demo-lichtwiese')
ON CONFLICT (paddock_id, reading_date) DO NOTHING;

-- Land C (lower quality — mixed land use)
INSERT INTO ndvi_readings (paddock_id, reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover, source)
SELECT p.id,
       d.reading_date::date,
       d.ndvi_mean, d.ndvi_min, d.ndvi_max, d.cloud_cover,
       'sentinel-2'
FROM paddocks p
CROSS JOIN (VALUES
    ('2025-06-15', 0.55, 0.40, 0.70, 5.2),
    ('2025-07-15', 0.58, 0.42, 0.73, 8.1),
    ('2025-08-15', 0.50, 0.36, 0.65, 12.4),
    ('2025-09-15', 0.43, 0.30, 0.58, 18.3),
    ('2025-10-15', 0.36, 0.24, 0.50, 22.0),
    ('2025-11-15', 0.30, 0.20, 0.42, 31.5),
    ('2025-12-15', 0.24, 0.15, 0.35, 45.0),
    ('2026-01-15', 0.22, 0.13, 0.33, 52.3),
    ('2026-02-15', 0.25, 0.16, 0.36, 38.1),
    ('2026-03-15', 0.34, 0.24, 0.46, 25.6)
) AS d(reading_date, ndvi_mean, ndvi_min, ndvi_max, cloud_cover)
WHERE p.paddock_name = 'Land C'
  AND p.farm_id = (SELECT id FROM farms WHERE customer_id = 'demo-lichtwiese')
ON CONFLICT (paddock_id, reading_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Verification queries — run these to confirm seed data loaded correctly
-- ---------------------------------------------------------------------------
-- SELECT farm_name, customer_id, country FROM farms;
-- SELECT paddock_name, area_ha, last_grazed_date FROM paddocks p JOIN farms f ON p.farm_id = f.id WHERE f.customer_id = 'demo-lichtwiese';
-- SELECT animal_id, species, collar_id FROM animals a JOIN farms f ON a.farm_id = f.id WHERE f.customer_id = 'demo-lichtwiese';
-- SELECT * FROM v_paddock_latest_ndvi WHERE farm_id = (SELECT id FROM farms WHERE customer_id = 'demo-lichtwiese');
