-- Add claimed_by column to todos table
ALTER TABLE todos ADD COLUMN claimed_by TEXT DEFAULT NULL;
