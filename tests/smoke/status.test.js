import { describe, expect, test } from "@jest/globals";
import smoke from "./request.js";

describe("Deployed API /api/v1/status", () => {
  test("Returns current status and valid database information", async () => {
    const requestedAt = Date.now();
    const response = await smoke.request("/api/v1/status");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    const updatedAt = Date.parse(body.updated_at);
    expect(Number.isNaN(updatedAt)).toBe(false);
    expect(new Date(updatedAt).toISOString()).toBe(body.updated_at);
    // Allow a small clock difference between the runner and the deployment.
    expect(updatedAt).toBeGreaterThanOrEqual(requestedAt - 60000);
    expect(updatedAt).toBeLessThanOrEqual(Date.now() + 60000);

    const database = body.dependencies.database;
    expect(database.version).toMatch(/^\d+$/);
    expect(Number.isInteger(database.max_connections)).toBe(true);
    expect(database.max_connections).toBeGreaterThan(0);
    expect(Number.isInteger(database.opened_connections)).toBe(true);
    expect(database.opened_connections).toBeGreaterThanOrEqual(0);
  });

  test("Accepts HEAD without a response body", async () => {
    const response = await smoke.request("/api/v1/status", "HEAD");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
