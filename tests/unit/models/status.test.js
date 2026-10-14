import status from "models/status";
import database from "infra/database";
import email from "infra/email";
import mailcatcher from "infra/mailcatcher";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Status environment isolation", () => {
  test("Omits MailCatcher in production even if a local URL is configured", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NODE_ENV: "production",
      EMAIL_HTTP_URL: "http://127.0.0.1:1080",
    });
    jest
      .spyOn(database, "query")
      .mockResolvedValueOnce({ rows: [{ server_version: "18.0" }] })
      .mockResolvedValueOnce({ rows: [{ max_connections: "100" }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });
    jest.spyOn(email, "verifyConnection").mockResolvedValue(true);
    const check = jest.spyOn(mailcatcher, "getStatus");

    const result = await status.getStatus();

    expect(result.dependencies).not.toHaveProperty("mailcatcher");
    expect(check).not.toHaveBeenCalled();
  });
});
