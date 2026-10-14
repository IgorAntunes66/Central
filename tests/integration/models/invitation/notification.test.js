import { createHash } from "node:crypto";
import { createServer } from "node:net";
import database from "infra/database";
import { ValidationError } from "infra/errors";
import invitation from "models/invitation";
import notification from "models/invitation/notification";
import orchestrator from "tests/orchestrator";

let user;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await orchestrator.deleteAllEmails();
  await database.query("DELETE FROM users;");
  user = await orchestrator.createUser();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function invitationUrl(message) {
  return new URL(message.text.match(/https?:\/\/\S+/)[0]);
}

async function countInvitations() {
  const result = await database.query(
    "SELECT count(*)::int AS count FROM user_invitations;",
  );
  return result.rows[0].count;
}

describe("models/invitation/notification.send", () => {
  test("Sends the invitation to the user's email with a valid first-access link", async () => {
    const sent = await notification.send(user.id);
    const message = await orchestrator.getLastEmail();
    const url = invitationUrl(message);
    expect(message.sender).toBe(`<${process.env.EMAIL_FROM}>`);
    expect(message.recipients).toEqual([`<${user.email}>`]);
    expect(message.subject).toBe("Defina sua senha na Central");
    expect(message.text).toContain(`Olá, ${user.name}!`);
    expect(message.text).toContain("24 horas");
    expect(url.origin).toBe(new URL(process.env.APP_BASE_URL).origin);
    expect(url.pathname).toBe("/primeiro-acesso");
    const token = url.searchParams.get("token");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(sent).not.toHaveProperty("token");
    expect(sent.user_id).toBe(user.id);
    const stored = await database.query({
      text: "SELECT * FROM user_invitations WHERE id = $1;",
      values: [sent.id],
    });
    expect(stored.rows[0].token_hash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    const activated = await invitation.accept({
      token,
      password: "Uma frase de senha segura",
    });
    expect(activated.id).toBe(user.id);
    expect(activated.status).toBe("active");
  });

  test("Uses the configured HTTPS origin in the invitation link", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      APP_BASE_URL: "https://central.example.test",
    });
    await notification.send(user.id);
    expect(invitationUrl(await orchestrator.getLastEmail()).origin).toBe(
      "https://central.example.test",
    );
  });

  test("Uses the Vercel branch URL for preview invitations without manual configuration", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      APP_BASE_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "central-git-invitations.example.test",
      VERCEL_URL: "central-deployment.example.test",
    });
    await notification.send(user.id);
    expect(invitationUrl(await orchestrator.getLastEmail()).origin).toBe(
      "https://central-git-invitations.example.test",
    );
  });

  test("Requires an explicit application origin in production", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      APP_BASE_URL: undefined,
      VERCEL_ENV: "production",
      VERCEL_URL: "central-production.example.test",
    });
    await expect(notification.send(user.id)).rejects.toThrow("APP_BASE_URL");
    expect(await countInvitations()).toBe(0);
  });

  test("A new email replaces the token from the previous email", async () => {
    await notification.send(user.id);
    const firstToken = invitationUrl(
      await orchestrator.getLastEmail(),
    ).searchParams.get("token");
    await notification.send(user.id);
    const secondToken = invitationUrl(
      await orchestrator.getLastEmail(),
    ).searchParams.get("token");
    expect(secondToken).not.toBe(firstToken);
    expect(await countInvitations()).toBe(1);
    await expect(
      invitation.accept({
        token: firstToken,
        password: "Uma frase de senha segura",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      (
        await invitation.accept({
          token: secondToken,
          password: "Uma frase de senha segura",
        })
      ).status,
    ).toBe("active");
  });

  test.each([
    undefined,
    "invalid",
    "http://example.test",
    "https://central.example.test/path",
    "https://central.example.test/?token=other",
    "https://central.example.test/#fragment",
    "https://user:password@central.example.test",
  ])(
    "Rejects an invalid application origin before creating an invitation: %p",
    async (origin) => {
      jest.replaceProperty(process, "env", {
        ...process.env,
        APP_BASE_URL: origin,
      });
      await expect(notification.send(user.id)).rejects.toThrow("APP_BASE_URL");
      expect(await countInvitations()).toBe(0);
    },
  );

  test("Rejects HTTP links in production", async () => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NODE_ENV: "production",
      APP_BASE_URL: "http://localhost:3000",
    });
    await expect(notification.send(user.id)).rejects.toThrow("APP_BASE_URL");
    jest.restoreAllMocks();
    expect(await countInvitations()).toBe(0);
  });

  test("Does not send invitations to a disabled user", async () => {
    await database.query({
      text: "UPDATE users SET status = 'inactive' WHERE id = $1;",
      values: [user.id],
    });
    await expect(notification.send(user.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await countInvitations()).toBe(0);
    const response = await fetch(`${process.env.EMAIL_HTTP_URL}/messages`);
    expect(await response.json()).toEqual([]);
  });

  test("Propagates an SMTP failure and permits a new sending attempt", async () => {
    const server = createServer((socket) =>
      socket.end("421 SMTP temporarily unavailable\r\n"),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      jest.replaceProperty(process, "env", {
        ...process.env,
        EMAIL_SMTP_HOST: "127.0.0.1",
        EMAIL_SMTP_PORT: String(server.address().port),
        EMAIL_SMTP_SECURE: "false",
      });
      await expect(notification.send(user.id)).rejects.toMatchObject({
        responseCode: 421,
      });
    } finally {
      jest.restoreAllMocks();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const failedInvitation = await database.query(
      "SELECT id FROM user_invitations;",
    );
    const sent = await notification.send(user.id);
    expect(sent.id).not.toBe(failedInvitation.rows[0].id);
    expect(await countInvitations()).toBe(1);
    expect((await orchestrator.getLastEmail()).recipients).toEqual([
      `<${user.email}>`,
    ]);
    const storedUser = await database.query({
      text: "SELECT status, password_hash FROM users WHERE id = $1;",
      values: [user.id],
    });
    expect(storedUser.rows[0]).toEqual({
      status: "invited",
      password_hash: null,
    });
  });
});
