  -- Project GTFS staging tables into the app's simplified bus_* schema.
  -- Notes:
  -- - The app schema can't represent multiple patterns/directions per route.
  --   We choose one representative trip per route: the trip with the most stop_times rows.
  -- - GTFS times can be > 24:00:00. We compute offsets in minutes and store them in route_stops.scheduled_time_offset.
  -- - schedules.departure_time is TIME (0-23h). We store the time modulo 24h.

  -- Helper: convert "HH:MM:SS" (HH can be >= 0) to seconds, returns NULL if not parseable.
  CREATE OR REPLACE FUNCTION gtfs.hhmmss_to_seconds(t TEXT)
  RETURNS INTEGER
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT CASE
      WHEN t IS NULL THEN NULL
      WHEN t ~ '^[0-9]{1,3}:[0-9]{2}:[0-9]{2}$' THEN
        (split_part(t, ':', 1)::INTEGER * 3600) +
        (split_part(t, ':', 2)::INTEGER * 60) +
        (split_part(t, ':', 3)::INTEGER)
      ELSE NULL
    END;
  $$;

  -- Helper: modulo-24 TIME from "HH:MM:SS" (supports HH>=24), returns NULL if not parseable.
  CREATE OR REPLACE FUNCTION gtfs.hhmmss_to_time_mod24(t TEXT)
  RETURNS TIME
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT CASE
      WHEN gtfs.hhmmss_to_seconds(t) IS NULL THEN NULL
      ELSE make_interval(secs => (gtfs.hhmmss_to_seconds(t) % 86400))::TIME
    END;
  $$;

  -- 1) Upsert bus_stops from gtfs.stops
  INSERT INTO bus_stops (stop_code, name, latitude, longitude, address, zone, is_active)
  SELECT
    COALESCE(NULLIF(s.stop_code, ''), s.stop_id) AS stop_code,
    COALESCE(NULLIF(s.stop_name, ''), s.stop_id) AS name,
    s.stop_lat::DECIMAL(10, 8) AS latitude,
    s.stop_lon::DECIMAL(11, 8) AS longitude,
    NULLIF(s.stop_desc, '') AS address,
    NULLIF(s.zone_id, '') AS zone,
    true AS is_active
  FROM gtfs.stops s
  WHERE s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
  ON CONFLICT (stop_code) DO UPDATE SET
    name = EXCLUDED.name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    address = EXCLUDED.address,
    zone = EXCLUDED.zone,
    is_active = true,
    updated_at = NOW();

  -- 2) Upsert bus_routes from gtfs.routes
  INSERT INTO bus_routes (route_number, route_name, color, is_active)
  SELECT
    COALESCE(NULLIF(r.route_short_name, ''), r.route_id) AS route_number,
    COALESCE(NULLIF(r.route_long_name, ''), NULLIF(r.route_desc, ''), COALESCE(NULLIF(r.route_short_name, ''), r.route_id)) AS route_name,
    CASE
      WHEN r.route_color ~ '^[0-9A-Fa-f]{6}$' THEN ('#' || r.route_color)
      WHEN r.route_color ~ '^#[0-9A-Fa-f]{6}$' THEN r.route_color
      ELSE '#3B82F6'
    END AS color,
    true AS is_active
  FROM gtfs.routes r
  ON CONFLICT (route_number) DO UPDATE SET
    route_name = EXCLUDED.route_name,
    color = EXCLUDED.color,
    is_active = true,
    updated_at = NOW();

  -- 3) Build route_stops from representative trip per route
  WITH trip_stop_counts AS (
    SELECT
      tr.feed_id,
      tr.route_id,
      tr.trip_id,
      tr.service_id,
      tr.direction_id,
      COUNT(*) AS stop_count
    FROM gtfs.trips tr
    JOIN gtfs.stop_times st
      ON st.feed_id = tr.feed_id AND st.trip_id = tr.trip_id
    GROUP BY tr.feed_id, tr.route_id, tr.trip_id, tr.service_id, tr.direction_id
  ),
  route_rep_trip AS (
    SELECT DISTINCT ON (feed_id, route_id)
      feed_id,
      route_id,
      trip_id,
      service_id,
      direction_id,
      stop_count
    FROM trip_stop_counts
    ORDER BY feed_id, route_id, stop_count DESC, trip_id
  ),
  rep_first_stop AS (
    SELECT
      rrt.feed_id,
      rrt.route_id,
      MIN(st.stop_sequence) AS first_seq
    FROM route_rep_trip rrt
    JOIN gtfs.stop_times st
      ON st.feed_id = rrt.feed_id AND st.trip_id = rrt.trip_id
    GROUP BY rrt.feed_id, rrt.route_id
  ),
  rep_base_time AS (
    SELECT
      rrt.feed_id,
      rrt.route_id,
      rrt.trip_id,
      gtfs.hhmmss_to_seconds(st.departure_time) AS base_departure_seconds
    FROM route_rep_trip rrt
    JOIN rep_first_stop rfs
      ON rfs.feed_id = rrt.feed_id AND rfs.route_id = rrt.route_id
    JOIN gtfs.stop_times st
      ON st.feed_id = rrt.feed_id AND st.trip_id = rrt.trip_id AND st.stop_sequence = rfs.first_seq
  )
  INSERT INTO route_stops (route_id, stop_id, stop_sequence, scheduled_time_offset)
  SELECT
    br.id AS route_id,
    bs.id AS stop_id,
    st.stop_sequence,
    CASE
      WHEN bt.base_departure_seconds IS NULL THEN 0
      WHEN gtfs.hhmmss_to_seconds(st.departure_time) IS NULL THEN 0
      ELSE GREATEST(0, FLOOR((gtfs.hhmmss_to_seconds(st.departure_time) - bt.base_departure_seconds) / 60.0))::INTEGER
    END AS scheduled_time_offset
  FROM route_rep_trip rrt
  JOIN gtfs.routes gr
    ON gr.feed_id = rrt.feed_id AND gr.route_id = rrt.route_id
  JOIN gtfs.stop_times st
    ON st.feed_id = rrt.feed_id AND st.trip_id = rrt.trip_id
  JOIN gtfs.stops gs
    ON gs.feed_id = st.feed_id AND gs.stop_id = st.stop_id
  JOIN rep_base_time bt
    ON bt.feed_id = rrt.feed_id AND bt.route_id = rrt.route_id AND bt.trip_id = rrt.trip_id
  JOIN bus_routes br
    ON br.route_number = COALESCE(NULLIF(gr.route_short_name, ''), gr.route_id)
  JOIN bus_stops bs
    ON bs.stop_code = COALESCE(NULLIF(gs.stop_code, ''), gs.stop_id)
  ON CONFLICT (route_id, stop_id) DO UPDATE SET
    stop_sequence = EXCLUDED.stop_sequence,
    scheduled_time_offset = EXCLUDED.scheduled_time_offset;

  -- 4) Build schedules from trips' first-stop departure times + calendar weekdays
  WITH trip_first_departures AS (
    SELECT
      tr.feed_id,
      tr.route_id,
      tr.service_id,
      tr.trip_id,
      MIN(st.stop_sequence) AS first_seq
    FROM gtfs.trips tr
    JOIN gtfs.stop_times st
      ON st.feed_id = tr.feed_id AND st.trip_id = tr.trip_id
    GROUP BY tr.feed_id, tr.route_id, tr.service_id, tr.trip_id
  ),
  trip_first_times AS (
    SELECT
      tfd.feed_id,
      tfd.route_id,
      tfd.service_id,
      gtfs.hhmmss_to_time_mod24(st.departure_time) AS departure_time_mod24
    FROM trip_first_departures tfd
    JOIN gtfs.stop_times st
      ON st.feed_id = tfd.feed_id AND st.trip_id = tfd.trip_id AND st.stop_sequence = tfd.first_seq
    WHERE gtfs.hhmmss_to_time_mod24(st.departure_time) IS NOT NULL
  ),
  service_days AS (
    SELECT
      c.feed_id,
      c.service_id,
      unnest(ARRAY[
        CASE WHEN c.sunday = 1 THEN 0 ELSE NULL END,
        CASE WHEN c.monday = 1 THEN 1 ELSE NULL END,
        CASE WHEN c.tuesday = 1 THEN 2 ELSE NULL END,
        CASE WHEN c.wednesday = 1 THEN 3 ELSE NULL END,
        CASE WHEN c.thursday = 1 THEN 4 ELSE NULL END,
        CASE WHEN c.friday = 1 THEN 5 ELSE NULL END,
        CASE WHEN c.saturday = 1 THEN 6 ELSE NULL END
      ]) AS day_of_week
    FROM gtfs.calendar c
  ),
  service_days_clean AS (
    SELECT feed_id, service_id, day_of_week
    FROM service_days
    WHERE day_of_week IS NOT NULL
  ),
  route_departures AS (
    SELECT DISTINCT
      tft.feed_id,
      tft.route_id,
      sdc.day_of_week,
      tft.departure_time_mod24
    FROM trip_first_times tft
    JOIN service_days_clean sdc
      ON sdc.feed_id = tft.feed_id AND sdc.service_id = tft.service_id
  )
  INSERT INTO schedules (route_id, day_of_week, departure_time, is_active)
  SELECT
    br.id AS route_id,
    rd.day_of_week,
    rd.departure_time_mod24,
    true
  FROM route_departures rd
  JOIN gtfs.routes gr
    ON gr.feed_id = rd.feed_id AND gr.route_id = rd.route_id
  JOIN bus_routes br
    ON br.route_number = COALESCE(NULLIF(gr.route_short_name, ''), gr.route_id)
  ON CONFLICT DO NOTHING;
