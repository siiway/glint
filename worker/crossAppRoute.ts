/**
 * Tiny helper that turns:
 *
 *   crossApp.post(
 *     "/api/cross-app/teams/:teamId/sets/:setId/todos",
 *     requireCrossAppAuth(["create_todos", "write_todos"]),
 *     createTodo,
 *   );
 *
 * into:
 *
 *   crossAppRoute(crossApp).post("/teams/:teamId/sets/:setId/todos",
 *     ["create_todos", "write_todos"], createTodo);
 *
 * The returned object accepts every HTTP verb crossApp supports and rewrites
 * paths to live under /api/cross-app/* automatically.
 */

import type { Hono, Handler, MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";
import { requireCrossAppAuth } from "./cross-app-auth";

const PREFIX = "/api/cross-app";

type Method = "get" | "post" | "patch" | "put" | "delete" | "all";

type CrossAppHandler = Handler<{ Bindings: Bindings; Variables: Variables }>;

interface CrossAppRouter {
  get(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
  post(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
  patch(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
  put(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
  delete(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
  all(
    path: string,
    scope: string | string[],
    ...handlers: (CrossAppHandler | MiddlewareHandler)[]
  ): void;
}

export function crossAppRoute(
  app: Hono<{ Bindings: Bindings; Variables: Variables }>,
): CrossAppRouter {
  const register = (
    method: Method,
    path: string,
    scope: string | string[],
    handlers: (CrossAppHandler | MiddlewareHandler)[],
  ) => {
    const fullPath = `${PREFIX}${path}`;
    // Hono's overloaded method signatures don't play nicely with a spread
    // tuple of mixed handler types, so cast to any. The runtime is fine.
    (app as unknown as Record<Method, (...args: unknown[]) => void>)[method](
      fullPath,
      requireCrossAppAuth(scope),
      ...handlers,
    );
  };
  return {
    get: (path, scope, ...handlers) => register("get", path, scope, handlers),
    post: (path, scope, ...handlers) => register("post", path, scope, handlers),
    patch: (path, scope, ...handlers) =>
      register("patch", path, scope, handlers),
    put: (path, scope, ...handlers) => register("put", path, scope, handlers),
    delete: (path, scope, ...handlers) =>
      register("delete", path, scope, handlers),
    all: (path, scope, ...handlers) => register("all", path, scope, handlers),
  };
}
