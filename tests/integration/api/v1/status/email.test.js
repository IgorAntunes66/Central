import { createServer } from "node:net";
import statusHandler from "pages/api/v1/status";
import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /api/v1/status with unavailable SMTP", () => {
  test("Returns 503 while preserving database diagnostics and hiding SMTP details", async () => {
    const server = createServer((socket) => {
      socket.end("421 SMTP temporarily unavailable\r\n");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      jest.replaceProperty(process, "env", {
        ...process.env,
        EMAIL_SMTP_HOST: "127.0.0.1",
        EMAIL_SMTP_PORT: String(server.address().port),
        EMAIL_SMTP_SECURE: "false",
      });
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Invoke the route here so its SMTP settings use the controlled server.
      await statusHandler({ method: "GET", url: "/api/v1/status" }, response);

      expect(response.status).toHaveBeenCalledWith(503);
      const body = response.json.mock.calls[0][0];
      expect(body.dependencies.database.version).toBe("18");
      expect(body.dependencies.email).toEqual({ connected: false });
      expect(JSON.stringify(body)).not.toContain(
        "SMTP temporarily unavailable",
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    }
  });
});
