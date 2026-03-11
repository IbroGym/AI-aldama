-- Seed data for Smart Bus Stop System
-- This creates sample data for development and demo purposes

-- Insert sample bus stops
INSERT INTO bus_stops (stop_code, name, latitude, longitude, address, zone, is_active, has_shelter, has_display) VALUES
('STOP001', 'Central Station', 40.7128, -74.0060, '123 Main Street', 'Downtown', true, true, true),
('STOP002', 'City Hall', 40.7135, -74.0071, '456 Government Ave', 'Downtown', true, true, true),
('STOP003', 'Tech Park', 40.7185, -74.0045, '789 Innovation Blvd', 'Business', true, true, true),
('STOP004', 'University Campus', 40.7205, -74.0025, '321 College Way', 'Education', true, true, true),
('STOP005', 'Medical Center', 40.7095, -74.0090, '555 Health Drive', 'Medical', true, true, true),
('STOP006', 'Shopping Mall', 40.7155, -74.0110, '777 Retail Plaza', 'Commercial', true, false, true),
('STOP007', 'Residential North', 40.7250, -74.0080, '999 Oak Street', 'Residential', true, false, false),
('STOP008', 'Residential South', 40.7050, -74.0040, '111 Pine Avenue', 'Residential', true, true, false),
('STOP009', 'Airport Terminal', 40.6895, -73.9867, '1 Airport Road', 'Airport', true, true, true),
('STOP010', 'Sports Arena', 40.7170, -74.0150, '222 Stadium Way', 'Entertainment', true, true, true)
ON CONFLICT (stop_code) DO NOTHING;

-- Insert sample bus routes
INSERT INTO bus_routes (route_number, route_name, color, is_active) VALUES
('R1', 'Downtown Express', '#EF4444', true),
('R2', 'University Line', '#3B82F6', true),
('R3', 'Airport Shuttle', '#10B981', true),
('R4', 'Medical District', '#F59E0B', true),
('R5', 'Shopping Circuit', '#8B5CF6', true)
ON CONFLICT (route_number) DO NOTHING;

-- Link routes to stops (with sequence and time offsets)
INSERT INTO route_stops (route_id, stop_id, stop_sequence, scheduled_time_offset)
SELECT r.id, s.id, seq.sequence, seq.time_offset
FROM (VALUES
  ('R1', 'STOP001', 1, 0),
  ('R1', 'STOP002', 2, 5),
  ('R1', 'STOP003', 3, 12),
  ('R1', 'STOP004', 4, 20),
  ('R2', 'STOP001', 1, 0),
  ('R2', 'STOP004', 2, 15),
  ('R2', 'STOP007', 3, 25),
  ('R3', 'STOP001', 1, 0),
  ('R3', 'STOP009', 2, 35),
  ('R4', 'STOP001', 1, 0),
  ('R4', 'STOP005', 2, 10),
  ('R4', 'STOP008', 3, 20),
  ('R5', 'STOP001', 1, 0),
  ('R5', 'STOP006', 2, 8),
  ('R5', 'STOP010', 3, 18)
) AS seq(route_num, stop_code, sequence, time_offset)
JOIN bus_routes r ON r.route_number = seq.route_num
JOIN bus_stops s ON s.stop_code = seq.stop_code
ON CONFLICT (route_id, stop_id) DO NOTHING;

-- Insert sample buses
INSERT INTO buses (bus_number, license_plate, capacity, is_active, current_route_id)
SELECT 
  bus.bus_number,
  bus.license_plate,
  bus.capacity,
  true,
  r.id
FROM (VALUES
  ('BUS001', 'ABC-1234', 50, 'R1'),
  ('BUS002', 'DEF-5678', 50, 'R1'),
  ('BUS003', 'GHI-9012', 45, 'R2'),
  ('BUS004', 'JKL-3456', 45, 'R2'),
  ('BUS005', 'MNO-7890', 30, 'R3'),
  ('BUS006', 'PQR-2345', 50, 'R4'),
  ('BUS007', 'STU-6789', 50, 'R5'),
  ('BUS008', 'VWX-0123', 45, 'R1')
) AS bus(bus_number, license_plate, capacity, route_num)
JOIN bus_routes r ON r.route_number = bus.route_num
ON CONFLICT (bus_number) DO NOTHING;

-- Insert sample GPS positions (recent positions for each bus)
INSERT INTO bus_positions (bus_id, latitude, longitude, speed, heading, recorded_at)
SELECT 
  b.id,
  40.7128 + (RANDOM() * 0.02 - 0.01),
  -74.0060 + (RANDOM() * 0.02 - 0.01),
  15 + RANDOM() * 25,
  RANDOM() * 360,
  NOW() - (INTERVAL '1 minute' * (RANDOM() * 5))
FROM buses b;

-- Insert sample ETA predictions
INSERT INTO eta_predictions (bus_id, stop_id, route_id, predicted_arrival, confidence)
SELECT 
  b.id,
  s.id,
  b.current_route_id,
  NOW() + (INTERVAL '1 minute' * (5 + RANDOM() * 20)),
  0.75 + (RANDOM() * 0.20)
FROM buses b
CROSS JOIN bus_stops s
WHERE b.current_route_id IS NOT NULL
LIMIT 30
ON CONFLICT (bus_id, stop_id, route_id) DO UPDATE SET
  predicted_arrival = EXCLUDED.predicted_arrival,
  confidence = EXCLUDED.confidence;

-- Insert sample schedules (key departure times throughout the day)
INSERT INTO schedules (route_id, day_of_week, departure_time, is_active)
SELECT 
  r.id,
  day.dow,
  time_slot.departure::TIME,
  true
FROM bus_routes r
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS day(dow)
CROSS JOIN (VALUES
  ('06:00'), ('06:15'), ('06:30'), ('06:45'),
  ('07:00'), ('07:15'), ('07:30'), ('07:45'),
  ('08:00'), ('08:15'), ('08:30'), ('08:45'),
  ('09:00'), ('09:30'),
  ('10:00'), ('10:30'),
  ('11:00'), ('11:30'),
  ('12:00'), ('12:30'),
  ('13:00'), ('13:30'),
  ('14:00'), ('14:30'),
  ('15:00'), ('15:30'),
  ('16:00'), ('16:15'), ('16:30'), ('16:45'),
  ('17:00'), ('17:15'), ('17:30'), ('17:45'),
  ('18:00'), ('18:15'), ('18:30'), ('18:45'),
  ('19:00'), ('19:30'),
  ('20:00'), ('20:30'),
  ('21:00'), ('21:30'),
  ('22:00')
) AS time_slot(departure)
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO alerts (alert_type, severity, title, message, is_active, starts_at, ends_at) VALUES
('delay', 'medium', 'Route R1 Delays', 'Due to road construction on Main Street, Route R1 may experience delays of 5-10 minutes.', true, NOW(), NOW() + INTERVAL '7 days'),
('info', 'low', 'Weekend Schedule', 'Reduced service on weekends. Buses run every 30 minutes instead of 15.', true, NOW(), NOW() + INTERVAL '30 days'),
('maintenance', 'low', 'Display Maintenance', 'Stop STOP007 display is undergoing scheduled maintenance.', true, NOW(), NOW() + INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Insert sample AI query logs
INSERT INTO ai_query_logs (stop_id, question, answer, intent, confidence, response_time_ms, was_successful, created_at)
SELECT 
  s.id,
  q.question,
  q.answer,
  q.intent,
  q.confidence,
  q.response_time,
  true,
  NOW() - (INTERVAL '1 hour' * (RANDOM() * 24))
FROM bus_stops s
CROSS JOIN (VALUES
  ('When is the next bus?', 'The next bus on Route R1 arrives in approximately 5 minutes.', 'eta_query', 0.95, 120),
  ('How do I get to the airport?', 'Take Route R3 Airport Shuttle from this stop. The journey takes about 35 minutes.', 'route_query', 0.88, 250),
  ('Is Route R2 running today?', 'Yes, Route R2 University Line is operating on its regular schedule today.', 'service_status', 0.92, 180),
  ('What time does the last bus leave?', 'The last bus from this stop departs at 10:00 PM.', 'schedule_query', 0.90, 150)
) AS q(question, answer, intent, confidence, response_time)
LIMIT 20;

-- Insert sample system metrics
INSERT INTO system_metrics (metric_name, metric_value, metric_unit, tags, recorded_at)
SELECT 
  metric.name,
  metric.base_value + (RANDOM() * metric.variance),
  metric.unit,
  metric.tags::JSONB,
  NOW() - (INTERVAL '5 minutes' * series.n)
FROM (VALUES
  ('api_response_time', 150, 50, 'ms', '{"endpoint": "eta"}'),
  ('api_response_time', 200, 75, 'ms', '{"endpoint": "ai_query"}'),
  ('active_buses', 6, 2, 'count', '{"status": "tracking"}'),
  ('daily_queries', 450, 100, 'count', '{"type": "ai"}'),
  ('system_uptime', 99.8, 0.2, 'percent', '{"service": "api"}')
) AS metric(name, base_value, variance, unit, tags)
CROSS JOIN generate_series(1, 20) AS series(n);
