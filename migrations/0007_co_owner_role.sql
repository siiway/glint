-- Add co-owner role to permissions table
-- SQLite doesn't support ALTER CHECK, so recreate the table
CREATE TABLE permissions_new (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  role TEXT NOT NULL CHECK (role IN ('co-owner', 'admin', 'member')),
  permission TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, scope, role, permission)
);

INSERT INTO permissions_new SELECT * FROM permissions;
DROP TABLE permissions;
ALTER TABLE permissions_new RENAME TO permissions;

CREATE INDEX IF NOT EXISTS idx_permissions_team ON permissions(team_id);
CREATE INDEX IF NOT EXISTS idx_permissions_team_scope ON permissions(team_id, scope);
