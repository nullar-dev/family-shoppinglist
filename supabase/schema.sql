-- Database Schema for Gezins Boodschappenlijst
-- Run this SQL in your Supabase project's SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (family members)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  pin VARCHAR(4) NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping rounds
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by_user_id UUID REFERENCES users(id),
  receipt_uploaded_at TIMESTAMPTZ,
  receipt_path TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  settled_at TIMESTAMPTZ,
  total_amount DECIMAL(10,2) DEFAULT 0,
  note TEXT
);

-- Items on the list
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  estimated_price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'active',
  requested_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  is_purchased BOOLEAN DEFAULT FALSE,
  is_in_cart BOOLEAN DEFAULT FALSE
);

-- Receipt lines
CREATE TABLE receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  matched_item_id UUID REFERENCES items(id),
  is_ignored BOOLEAN DEFAULT FALSE
);

-- Cost allocations
CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) DEFAULT 100
);

-- Create indexes
CREATE INDEX idx_rounds_state ON rounds(state);
CREATE INDEX idx_rounds_created_at ON rounds(created_at DESC);
CREATE INDEX idx_items_round_id ON items(round_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_receipt_lines_round_id ON receipt_lines(round_id);
CREATE INDEX idx_allocations_item_id ON allocations(item_id);
CREATE INDEX idx_allocations_user_id ON allocations(user_id);

-- Enable Row Level Security (optional - for family app, we can skip for simplicity)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE receipt_lines ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;

-- Insert default users (Alice, Bob, Charlie, Diana)
INSERT INTO users (name, pin, color) VALUES
  ('Alice', '1234', '#EF4444'),  -- Red
  ('Bob', '2345', '#3B82F6'),    -- Blue
  ('Charlie', '3456', '#22C55E'), -- Green
  ('Diana', '4567', '#F59E0B');   -- Amber

-- Create first OPEN round
INSERT INTO rounds (state) VALUES ('OPEN');

-- Insert sample items for the first round
INSERT INTO items (round_id, name, quantity, estimated_price, created_by_user_id)
SELECT r.id, 'Melk', 1, 1.50, u.id
FROM rounds r, users u
WHERE r.state = 'OPEN' AND u.name = 'Alice'
LIMIT 1;

-- For this app, let's add a function to get the current open round
CREATE OR REPLACE FUNCTION get_open_round()
RETURNS TABLE (
  id UUID,
  state VARCHAR(20),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.state, r.created_at
  FROM rounds r
  WHERE r.state = 'OPEN'
  ORDER BY r.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create a function to initialize a new round if none exists
CREATE OR REPLACE FUNCTION ensure_open_round_exists()
RETURNS UUID AS $$
DECLARE
  open_round_id UUID;
  round_count INT;
BEGIN
  SELECT COUNT(*) INTO round_count FROM rounds WHERE state = 'OPEN';

  IF round_count = 0 THEN
    INSERT INTO rounds (state) VALUES ('OPEN') RETURNING id INTO open_round_id;
    RETURN open_round_id;
  ELSE
    SELECT id INTO open_round_id FROM rounds WHERE state = 'OPEN' ORDER BY created_at DESC LIMIT 1;
    RETURN open_round_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
