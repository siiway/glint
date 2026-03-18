-- Migration: 0002_permissions
-- Created: 2026-03-18
-- Description: Granular permission system for teams

-- Team-level and per-set permissions
-- scope: 'global' for team-wide, 'set:<set_id>' for per-set overrides
-- role: 'admin' or 'member' (owner always has full access, not stored)
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  permission TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, scope, role, permission)
);

CREATE INDEX IF NOT EXISTS idx_permissions_team ON permissions(team_id);
CREATE INDEX IF NOT EXISTS idx_permissions_team_scope ON permissions(team_id, scope);
