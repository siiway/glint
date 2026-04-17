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
import sharesRoutes from "./routes/shares";
import crossAppRoutes from "./routes/cross-app";
import wsRoutes from "./routes/ws";
import userSettingsRoutes from "./routes/userSettings";
export { TodoSync } from "./durable-objects/todo-sync";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.route("/", initRoutes);
app.route("/", authRoutes);
app.route("/", settingsRoutes);
app.route("/", permissionsRoutes);
app.route("/", setsRoutes);
app.route("/", todosRoutes);
app.route("/", commentsRoutes);
app.route("/", sharesRoutes);
app.route("/", crossAppRoutes);
app.route("/", wsRoutes);
app.route("/", userSettingsRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    await processAutoRenew(env);
  },
};
