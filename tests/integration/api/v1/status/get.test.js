import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("GET /api/v1/status", () => {
  describe("Anonymous user", () => {
    test("Retrieving current system status", async () => {
      const requestedAt = Date.now();
      const response = await fetch("http://localhost:3000/api/v1/status");
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      const updatedAt = Date.parse(responseBody.updated_at);
      expect(Number.isNaN(updatedAt)).toBe(false);
      expect(new Date(updatedAt).toISOString()).toBe(responseBody.updated_at);
      expect(updatedAt).toBeGreaterThanOrEqual(requestedAt);
      expect(updatedAt).toBeLessThanOrEqual(Date.now());

      expect(responseBody.dependencies.database.version).toBe("18");
      expect(responseBody.dependencies.database.max_connections).toBe(100);
      expect(responseBody.dependencies.database.opened_connections).toBe(1);
      expect(responseBody.dependencies.email).toEqual({ connected: true });
    });

    test("Checking SMTP availability without sending an email", async () => {
      const messagesBefore = await fetch(
        `${process.env.EMAIL_HTTP_URL}/messages`,
      );
      expect(messagesBefore.status).toBe(200);
      const previousEmails = await messagesBefore.json();

      const response = await fetch("http://localhost:3000/api/v1/status");
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.dependencies.email.connected).toBe(true);

      const messagesAfter = await fetch(
        `${process.env.EMAIL_HTTP_URL}/messages`,
      );
      expect(messagesAfter.status).toBe(200);
      expect(await messagesAfter.json()).toEqual(previousEmails);
    });
  });
});
