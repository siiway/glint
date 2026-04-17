import { Hono } from "hono";
import type { Bindings, Variables, UserSettings } from "../types";
import { requireAuth } from "../auth";

const userSettings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const KV_KEY = (userId: string) => `user_settings:${userId}`;

userSettings.get("/api/user/settings", requireAuth, async (c) => {
  const session = c.get("session");
  const settings =
    (await c.env.KV.get<UserSettings>(KV_KEY(session.userId), "json")) ?? {};
  return c.json({ settings });
});

userSettings.put("/api/user/settings", requireAuth, async (c) => {
  const session = c.get("session");
  const body = await c.req.json<Partial<UserSettings>>();

  const existing =
    (await c.env.KV.get<UserSettings>(KV_KEY(session.userId), "json")) ?? {};

  const allowed: (keyof UserSettings)[] = ["action_bar", "realtime_transport"];
  const patch: UserSettings = { ...existing };
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }

  await c.env.KV.put(KV_KEY(session.userId), JSON.stringify(patch));
  return c.json({ settings: patch });
});

export default userSettings;
