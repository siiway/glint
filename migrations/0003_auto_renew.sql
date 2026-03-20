-- Migration: 0003_auto_renew
-- Created: 2026-03-18
-- Description: Add auto-renew and timezone settings to todo sets

ALTER TABLE todo_sets ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todo_sets ADD COLUMN renew_time TEXT NOT NULL DEFAULT '00:00';
ALTER TABLE todo_sets ADD COLUMN timezone TEXT NOT NULL DEFAULT '';
ALTER TABLE todo_sets ADD COLUMN last_renewed_at TEXT;
