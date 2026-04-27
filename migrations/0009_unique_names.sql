-- Migration: 0009_unique_names
-- Created: 2026-04-28
-- Description: Enforce unique todo list names per team and unique todo titles per list

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_sets_team_name_unique
ON todo_sets(team_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_set_title_unique
ON todos(set_id, title);
