-- Migration: 0008_split_completed
-- Created: 2026-04-18
-- Description: Add split_completed setting to todo sets

ALTER TABLE todo_sets ADD COLUMN split_completed INTEGER NOT NULL DEFAULT 0;
