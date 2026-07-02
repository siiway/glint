-- Migration: 0010_assignees
-- Created: 2026-06-30
-- Description: Multi-assignee support. A todo can be assigned to several people.
--   Replaces the single-user "claim" model (todos.claimed_by) with a
--   todo_assignees join table. Existing claims migrate to "assigned to self".
--   The claim_todos permission is renamed to assign_todos.

CREATE TABLE IF NOT EXISTS todo_assignees (
  todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (todo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_todo_assignees_user ON todo_assignees(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignees_todo ON todo_assignees(todo_id);

-- Migrate existing single-claim ownership to self-assignment. The person who
-- claimed the todo becomes both the assignee and the assigner.
INSERT OR IGNORE INTO todo_assignees (todo_id, user_id, team_id, assigned_by)
SELECT id, claimed_by, team_id, claimed_by
FROM todos
WHERE claimed_by IS NOT NULL;

-- Rename the claim_todos permission overrides to assign_todos so any explicit
-- per-team / per-set overrides carry over to the renamed permission key.
UPDATE permissions SET permission = 'assign_todos' WHERE permission = 'claim_todos';
