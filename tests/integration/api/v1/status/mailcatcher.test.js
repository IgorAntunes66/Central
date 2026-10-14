import { createServer } from "node:http";
import statusHandler from "pages/api/v1/status";
import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /api/v1/status with unavailable MailCatcher HTTP interface", () => {
  test("Reports HTTP failure independently of the working SMTP connection", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(503);
      response.end("HTTP unavailable");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      jest.replaceProperty(process, "env", {
        ...process.env,
        EMAIL_HTTP_URL: `http://127.0.0.1:${server.address().port}`,
      });
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await statusHandler({ method: "GET", url: "/api/v1/status" }, response);

      expect(response.status).toHaveBeenCalledWith(503);
      const body = response.json.mock.calls[0][0];
      expect(body.dependencies.email.connected).toBe(true);
      expect(body.dependencies.mailcatcher).toEqual({
        connected: false,
        web_url: process.env.EMAIL_HTTP_URL,
        captured_messages: null,
        version: null,
      });
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
