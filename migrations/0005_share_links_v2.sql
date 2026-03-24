-- Migration: 0005_share_links_v2
-- Created: 2026-03-24
-- Description: Add per-link permissions, email restrictions, and multi-link support

ALTER TABLE share_links ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE share_links ADD COLUMN can_view INTEGER NOT NULL DEFAULT 1;
ALTER TABLE share_links ADD COLUMN can_create INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN can_edit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN can_complete INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN can_delete INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN can_comment INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN can_reorder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN allowed_emails TEXT NOT NULL DEFAULT '';
ALTER TABLE share_links ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- Drop old unique constraint by recreating the index (set_id no longer unique per set)
DROP INDEX IF EXISTS idx_share_links_set;
CREATE INDEX IF NOT EXISTS idx_share_links_set_team ON share_links(set_id, team_id);
CREATE INDEX IF NOT EXISTS idx_share_links_team ON share_links(team_id);
