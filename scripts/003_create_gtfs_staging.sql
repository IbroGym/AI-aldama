-- GTFS Static staging schema (raw import)
-- Load GTFS files into these tables first, then project into bus_* tables.

CREATE SCHEMA IF NOT EXISTS gtfs;

-- Keep columns close to GTFS spec; store times as text to support values > 24:00:00.

CREATE TABLE IF NOT EXISTS gtfs.agency (
  feed_id TEXT,
  agency_id TEXT,
  agency_name TEXT,
  agency_url TEXT,
  agency_timezone TEXT,
  agency_lang TEXT,
  agency_phone TEXT,
  agency_fare_url TEXT,
  agency_email TEXT,
  _imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtfs.stops (
  feed_id TEXT,
  stop_id TEXT NOT NULL,
  stop_code TEXT,
  stop_name TEXT,
  stop_desc TEXT,
  stop_lat DOUBLE PRECISION,
  stop_lon DOUBLE PRECISION,
  zone_id TEXT,
  stop_url TEXT,
  location_type INTEGER,
  parent_station TEXT,
  wheelchair_boarding INTEGER,
  platform_code TEXT,
  _imported_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, stop_id)
);

CREATE TABLE IF NOT EXISTS gtfs.routes (
  feed_id TEXT,
  route_id TEXT NOT NULL,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER,
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT,
  _imported_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, route_id)
);

CREATE TABLE IF NOT EXISTS gtfs.trips (
  feed_id TEXT,
  route_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id INTEGER,
  block_id TEXT,
  shape_id TEXT,
  wheelchair_accessible INTEGER,
  bikes_allowed INTEGER,
  _imported_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, trip_id)
);

CREATE TABLE IF NOT EXISTS gtfs.stop_times (
  feed_id TEXT,
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  stop_headsign TEXT,
  pickup_type INTEGER,
  drop_off_type INTEGER,
  shape_dist_traveled DOUBLE PRECISION,
  timepoint INTEGER,
  _imported_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, trip_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS gtfs.calendar (
  feed_id TEXT,
  service_id TEXT NOT NULL,
  monday INTEGER,
  tuesday INTEGER,
  wednesday INTEGER,
  thursday INTEGER,
  friday INTEGER,
  saturday INTEGER,
  sunday INTEGER,
  start_date TEXT,
  end_date TEXT,
  _imported_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip ON gtfs.stop_times(feed_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop ON gtfs.stop_times(feed_id, stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route ON gtfs.trips(feed_id, route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_service ON gtfs.trips(feed_id, service_id);
