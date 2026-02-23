-- Add storage bucket for receipts
-- Run this SQL in your Supabase project's SQL Editor

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true);

-- Create policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Create policy to allow public read access
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (bucket_id = 'receipts');
