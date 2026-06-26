import type { Bindings } from "./types";
import { getTeamSettings } from "./config";

export async function processAutoRenew(env: Bindings) {
  const now = new Date();

  const sets = await env.DB.prepare(
    "SELECT id, team_id, renew_time, timezone, last_renewed_at FROM todo_sets WHERE auto_renew = 1",
  ).all();

  for (const set of sets.results) {
    const setId = set.id as string;
    const teamId = set.team_id as string;
    const renewTime = (set.renew_time as string) || "00:00";
    let tz = (set.timezone as string) || "";

    if (!tz) {
      const settings = await getTeamSettings(env.KV, teamId);
      tz = settings.default_timezone || "UTC";
    }

    const tzOrUtc = tz || "UTC";
    const localDate = now.toLocaleDateString("en-CA", {
      timeZone: tzOrUtc,
    });

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tzOrUtc,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const timeParts = Object.fromEntries(
      timeFormatter
        .formatToParts(now)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
    const localTime = `${String(timeParts.hour).padStart(2, "0")}:${String(timeParts.minute).padStart(2, "0")}`;

    const lastRenewed = set.last_renewed_at as string | null;
    const lastDate = lastRenewed
      ? new Date(lastRenewed).toLocaleDateString("en-CA", {
          timeZone: tzOrUtc,
        })
      : null;

    if (localTime >= renewTime && lastDate !== localDate) {
      await env.DB.prepare(
        "UPDATE todos SET completed = 0, updated_at = datetime('now') WHERE set_id = ? AND team_id = ? AND completed = 1",
      )
        .bind(setId, teamId)
        .run();

      await env.DB.prepare(
        "UPDATE todo_sets SET last_renewed_at = ? WHERE id = ?",
      )
        .bind(now.toISOString(), setId)
        .run();
    }
  }
}
