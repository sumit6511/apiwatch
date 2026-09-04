import { describe, expect, it } from "vitest";

import { sortMonitors } from "./monitorSort";
import { makeMonitor } from "../test-fixtures";

describe("sortMonitors", () => {
  const a = makeMonitor({ id: "a", name: "Charlie", status: "UP", uptime: { period_24h: 99, period_7d: 99, period_30d: 99 } });
  const b = makeMonitor({ id: "b", name: "Alpha", status: "DOWN", uptime: { period_24h: 50, period_7d: 50, period_30d: 50 } });
  const c = makeMonitor({ id: "c", name: "Bravo", status: "PAUSED", uptime: null });
  const monitors = [a, b, c];

  it("returns the input order unchanged for 'newest' (already newest-first from the API)", () => {
    expect(sortMonitors(monitors, "newest")).toEqual(monitors);
  });

  it("sorts by name A-Z for 'name'", () => {
    expect(sortMonitors(monitors, "name").map((m) => m.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts DOWN first, then UNKNOWN, then PAUSED, then UP for 'status'", () => {
    const withUnknown = [...monitors, makeMonitor({ id: "d", name: "Delta", status: "UNKNOWN" })];
    expect(sortMonitors(withUnknown, "status").map((m) => m.status)).toEqual(["DOWN", "UNKNOWN", "PAUSED", "UP"]);
  });

  it("sorts lowest uptime first for 'uptime', treating missing data as worse than 0%", () => {
    expect(sortMonitors(monitors, "uptime").map((m) => m.name)).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  it("does not mutate the input array", () => {
    const original = [...monitors];
    sortMonitors(monitors, "name");
    expect(monitors).toEqual(original);
  });
});
