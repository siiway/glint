import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import {
  claimTodo,
  createTodo,
  deleteTodo,
  listTodos,
  moveTodo,
  patchTodo,
  reorderTodos,
} from "../handlers/todos";

const todos = new Hono<{ Bindings: Bindings; Variables: Variables }>();

todos.get("/api/teams/:teamId/sets/:setId/todos", requireAuth, listTodos);
todos.post("/api/teams/:teamId/sets/:setId/todos", requireAuth, createTodo);
todos.patch("/api/teams/:teamId/todos/:id", requireAuth, patchTodo);
todos.post("/api/teams/:teamId/todos/reorder", requireAuth, reorderTodos);
todos.post("/api/teams/:teamId/todos/:id/move", requireAuth, moveTodo);
todos.delete("/api/teams/:teamId/todos/:id", requireAuth, deleteTodo);
todos.post("/api/teams/:teamId/todos/:id/claim", requireAuth, claimTodo);

export default todos;
