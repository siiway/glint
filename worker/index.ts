import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import { processAutoRenew } from "./cron";

import initRoutes from "./routes/init";
import authRoutes from "./routes/auth";
import settingsRoutes from "./routes/settings";
import permissionsRoutes from "./routes/permissions";
import setsRoutes from "./routes/sets";
import todosRoutes from "./routes/todos";
import commentsRoutes from "./routes/comments";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.route("/", initRoutes);
app.route("/", authRoutes);
app.route("/", settingsRoutes);
app.route("/", permissionsRoutes);
app.route("/", setsRoutes);
app.route("/", todosRoutes);
app.route("/", commentsRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    await processAutoRenew(env);
  },
};
