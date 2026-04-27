-- Migration: 0009_unique_names
-- Created: 2026-04-28
-- Description: Enforce unique todo list names per team and unique todo titles per sibling level

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_sets_team_name_unique
ON todo_sets(team_id, name);

-- Deduplicate only same-level duplicates (same set_id + same parent_id + same title).
UPDATE todos
SET title = title || ' [dedup:' || id || ']'
WHERE id IN (
  SELECT t.id
  FROM todos t
  JOIN (
    SELECT set_id, parent_id, title
    FROM todos
    GROUP BY set_id, parent_id, title
    HAVING COUNT(*) > 1
  ) dup
    ON dup.set_id = t.set_id
   AND dup.title = t.title
   AND (
     (dup.parent_id IS NULL AND t.parent_id IS NULL)
     OR dup.parent_id = t.parent_id
   )
  WHERE t.id NOT IN (
    SELECT MIN(id)
    FROM todos
    GROUP BY set_id, parent_id, title
  )
);

DROP INDEX IF EXISTS idx_todos_set_title_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_set_title_unique
ON todos(set_id, COALESCE(parent_id, '__root__'), title);
