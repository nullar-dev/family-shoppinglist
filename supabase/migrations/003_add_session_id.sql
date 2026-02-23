-- Add session_id column to users table for single-session login
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT gen_random_uuid();

-- Set a default session_id for existing users
UPDATE users SET session_id = gen_random_uuid() WHERE session_id IS NULL;
