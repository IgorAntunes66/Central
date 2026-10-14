import { describe, expect, test } from "@jest/globals";
import smoke from "./request.js";

describe("Deployed first-access routes without writes", () => {
  test("Renders an unknown invitation using the migrated database", async () => {
    const response = await smoke.request(
      `/primeiro-acesso?token=${"0".repeat(64)}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toMatch(/no-store|no-cache/);
    const body = await response.text();
    expect(body).toContain("Precisamos de um novo convite.");
    expect(body).not.toContain('id="password"');
  });

  test("Rejects HEAD on the acceptance endpoint without changing data", async () => {
    const response = await smoke.request("/api/v1/invitations/accept", "HEAD");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.text()).toBe("");
  });
});
