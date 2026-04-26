import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import { getSettings, patchSettings } from "../handlers/settings";

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

settings.get("/api/teams/:teamId/settings", requireAuth, getSettings);
settings.patch("/api/teams/:teamId/settings", requireAuth, patchSettings);

export default settings;
