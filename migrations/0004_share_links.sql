-- Migration: 0004_share_links
-- Created: 2026-03-23
-- Description: Share links for todo sets - allows public view/edit access via token

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES todo_sets(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_set ON share_links(set_id);
