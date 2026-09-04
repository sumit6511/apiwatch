import { describe, expect, it } from "vitest";

import { formatResponseTimeOrStatus } from "./format";

describe("formatResponseTimeOrStatus", () => {
  it("shows an em dash when no check has run yet", () => {
    expect(formatResponseTimeOrStatus(null, null)).toBe("—");
  });

  it("shows the formatted duration for a real response", () => {
    expect(formatResponseTimeOrStatus(200, 183)).toBe("183ms");
    expect(formatResponseTimeOrStatus(500, 1240)).toBe("1.24s");
  });

  it("shows 'No response' rather than a misleading duration when there's no http_status", () => {
    // A timeout, SSRF block, or connection failure all leave http_status
    // null while response_time_ms still holds a number (elapsed/waited
    // time) -- that's not a measured server response time and shouldn't
    // read as one.
    expect(formatResponseTimeOrStatus(null, 10000)).toBe("No response");
  });
});
