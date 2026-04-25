import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import {
  createComment,
  deleteComment,
  listComments,
} from "../handlers/comments";

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

comments.get(
  "/api/teams/:teamId/todos/:todoId/comments",
  requireAuth,
  listComments,
);
comments.post(
  "/api/teams/:teamId/todos/:todoId/comments",
  requireAuth,
  createComment,
);
comments.delete(
  "/api/teams/:teamId/todos/:todoId/comments/:commentId",
  requireAuth,
  deleteComment,
);

export default comments;
