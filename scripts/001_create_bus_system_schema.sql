-- Smart Bus Stop System Database Schema
-- This creates all tables needed for the transit management system

-- Bus Stops Table - Stores all physical bus stop locations
CREATE TABLE IF NOT EXISTS bus_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  zone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  has_shelter BOOLEAN DEFAULT false,
  has_display BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bus Routes Table - Stores route information
CREATE TABLE IF NOT EXISTS bus_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number VARCHAR(20) UNIQUE NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route Stops Junction Table - Links routes to stops with sequence
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  stop_sequence INTEGER NOT NULL,
  scheduled_time_offset INTEGER DEFAULT 0, -- minutes from route start
  UNIQUE(route_id, stop_id),
  UNIQUE(route_id, stop_sequence)
);

-- Buses Table - Stores vehicle information
CREATE TABLE IF NOT EXISTS buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number VARCHAR(20) UNIQUE NOT NULL,
  license_plate VARCHAR(20),
  capacity INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  current_route_id UUID REFERENCES bus_routes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bus GPS Positions Table - Real-time GPS tracking data
CREATE TABLE IF NOT EXISTS bus_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient GPS lookups
CREATE INDEX IF NOT EXISTS idx_bus_positions_recorded_at ON bus_positions(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_positions_bus_id ON bus_positions(bus_id);

-- ETA Predictions Table - Stores predicted arrival times
CREATE TABLE IF NOT EXISTS eta_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  predicted_arrival TIMESTAMPTZ NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.80,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bus_id, stop_id, route_id)
);

-- AI Query Logs Table - Stores all AI question/answer interactions
CREATE TABLE IF NOT EXISTS ai_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID REFERENCES bus_stops(id),
  question TEXT NOT NULL,
  answer TEXT,
  intent VARCHAR(100),
  confidence DECIMAL(3, 2),
  response_time_ms INTEGER,
  was_successful BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Metrics Table - For monitoring and analytics
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15, 4) NOT NULL,
  metric_unit VARCHAR(50),
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- Schedules Table - Timetable data
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  departure_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts Table - System-wide alerts and notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  affected_routes UUID[] DEFAULT '{}',
  affected_stops UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles for admin access
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE eta_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read all transit data
CREATE POLICY "Allow public read access to bus_stops" ON bus_stops FOR SELECT USING (true);
CREATE POLICY "Allow public read access to bus_routes" ON bus_routes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to route_stops" ON route_stops FOR SELECT USING (true);
CREATE POLICY "Allow public read access to buses" ON buses FOR SELECT USING (true);
CREATE POLICY "Allow public read access to bus_positions" ON bus_positions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to eta_predictions" ON eta_predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to schedules" ON schedules FOR SELECT USING (true);
CREATE POLICY "Allow public read access to alerts" ON alerts FOR SELECT USING (true);

-- AI query logs - anyone can insert (from kiosk), only authenticated can read
CREATE POLICY "Allow public insert to ai_query_logs" ON ai_query_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated read access to ai_query_logs" ON ai_query_logs FOR SELECT TO authenticated USING (true);

-- System metrics - only authenticated users
CREATE POLICY "Allow authenticated read access to system_metrics" ON system_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert to system_metrics" ON system_metrics FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles - users can only see/edit their own
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admin policies for data modification
CREATE POLICY "Allow admin insert to bus_stops" ON bus_stops FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin update to bus_stops" ON bus_stops FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
);

CREATE POLICY "Allow admin insert to bus_routes" ON bus_routes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin update to bus_routes" ON bus_routes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
);

CREATE POLICY "Allow admin insert to buses" ON buses FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin update to buses" ON buses FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
);

-- Allow system to insert GPS and ETA data
CREATE POLICY "Allow system insert to bus_positions" ON bus_positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow system insert to eta_predictions" ON eta_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow system update to eta_predictions" ON eta_predictions FOR UPDATE USING (true);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE bus_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE eta_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
