import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import {
  createSet,
  deleteSet,
  exportSet,
  importIntoSet,
  importNewSet,
  listSets,
  patchSet,
  reorderSets,
} from "../handlers/sets";

const sets = new Hono<{ Bindings: Bindings; Variables: Variables }>();

sets.get("/api/teams/:teamId/sets", requireAuth, listSets);
sets.post("/api/teams/:teamId/sets", requireAuth, createSet);
sets.patch("/api/teams/:teamId/sets/:setId", requireAuth, patchSet);
sets.delete("/api/teams/:teamId/sets/:setId", requireAuth, deleteSet);
sets.post("/api/teams/:teamId/sets/reorder", requireAuth, reorderSets);
sets.get("/api/teams/:teamId/sets/:setId/export", requireAuth, exportSet);
sets.post("/api/teams/:teamId/sets/:setId/import", requireAuth, importIntoSet);
sets.post("/api/teams/:teamId/sets/import", requireAuth, importNewSet);

export default sets;
