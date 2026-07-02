import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import {
  createTodo,
  deleteTodo,
  listTodos,
  moveTodo,
  patchTodo,
  reorderTodos,
} from "../handlers/todos";
import {
  listMembers,
  setAssignees,
  getAssignedToMe,
  setAssignedExpandState,
} from "../handlers/assignees";

const todos = new Hono<{ Bindings: Bindings; Variables: Variables }>();

todos.get("/api/teams/:teamId/sets/:setId/todos", requireAuth, listTodos);
todos.post("/api/teams/:teamId/sets/:setId/todos", requireAuth, createTodo);
todos.patch("/api/teams/:teamId/todos/:id", requireAuth, patchTodo);
todos.post("/api/teams/:teamId/todos/reorder", requireAuth, reorderTodos);
todos.post("/api/teams/:teamId/todos/:id/move", requireAuth, moveTodo);
todos.delete("/api/teams/:teamId/todos/:id", requireAuth, deleteTodo);

// Assignment
todos.get("/api/teams/:teamId/members", requireAuth, listMembers);
todos.put("/api/teams/:teamId/todos/:id/assignees", requireAuth, setAssignees);
todos.get("/api/teams/:teamId/assigned-to-me", requireAuth, getAssignedToMe);
todos.post(
  "/api/teams/:teamId/assigned-expand",
  requireAuth,
  setAssignedExpandState,
);

export default todos;
