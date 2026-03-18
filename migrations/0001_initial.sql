-- Migration: 0001_initial
-- Created: 2026-03-18
-- Description: Initial schema - todo sets, todos (with sub-todos), comments

CREATE TABLE IF NOT EXISTS todo_sets (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todo_sets_team ON todo_sets(team_id);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES todo_sets(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  parent_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_set ON todos(set_id);
CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_set_sort ON todos(set_id, sort_order);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id);
