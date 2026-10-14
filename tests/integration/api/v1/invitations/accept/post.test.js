import database from "infra/database";
import invitation from "models/invitation";
import password from "models/password";
import orchestrator from "tests/orchestrator";

const endpoint = "http://localhost:3000/api/v1/invitations/accept";
const validPassword = "Uma frase de senha segura";
let user;
let created;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await database.query("DELETE FROM users;");
  user = await orchestrator.createUser();
  created = await invitation.create(user.id);
});

async function acceptInvitation(overrides = {}) {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: created.token,
      password: validPassword,
      ...overrides,
    }),
  });
}

async function findUser() {
  const result = await database.query({
    text: "SELECT * FROM users WHERE id = $1;",
    values: [user.id],
  });
  return result.rows[0];
}

async function findInvitation() {
  const result = await database.query({
    text: "SELECT * FROM user_invitations WHERE id = $1;",
    values: [created.id],
  });
  return result.rows[0];
}

async function expectValidationError(response) {
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toEqual({
    name: "ValidationError",
    message: expect.any(String),
    action: "Corrija os dados informados e tente novamente.",
    status_code: 400,
  });
  expect(JSON.stringify(body)).not.toContain(created.token);
  expect(JSON.stringify(body)).not.toContain(validPassword);
}

describe("POST /api/v1/invitations/accept", () => {
  test("Activates the invited user without exposing credentials or starting a session", async () => {
    const response = await acceptInvitation();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    const body = await response.json();
    expect(body).toEqual({
      id: user.id,
      company_id: null,
      name: user.name,
      email: user.email,
      role: user.role,
      status: "active",
      created_at: user.created_at.toISOString(),
      updated_at: expect.any(String),
    });
    const stored = await findUser();
    expect(await password.compare(validPassword, stored.password_hash)).toBe(
      true,
    );
    expect((await findInvitation()).used_at).toBeInstanceOf(Date);
  });

  test.each([
    { token: null },
    { token: "invalid" },
    { token: "a".repeat(64) },
    { password: null },
    { password: 123 },
    { password: "short" },
    { password: "a".repeat(73) },
  ])("Rejects invalid token or password: %p", async (overrides) => {
    await expectValidationError(await acceptInvitation(overrides));
    expect((await findUser()).status).toBe("invited");
    expect((await findUser()).password_hash).toBeNull();
    expect((await findInvitation()).used_at).toBeNull();
  });

  test.each([null, [], "invalid", {}])(
    "Rejects an invalid body: %p",
    async (data) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      expect(response.status).toBe(400);
      expect((await findUser()).status).toBe("invited");
      expect((await findInvitation()).used_at).toBeNull();
    },
  );

  test("Rejects an expired invitation", async () => {
    await database.query({
      text: "UPDATE user_invitations SET created_at = current_timestamp - interval '2 days', expires_at = current_timestamp - interval '1 day' WHERE id = $1;",
      values: [created.id],
    });
    await expectValidationError(await acceptInvitation());
    expect((await findUser()).status).toBe("invited");
  });

  test("Rejects a previously used invitation without changing the password", async () => {
    expect((await acceptInvitation()).status).toBe(200);
    await expectValidationError(
      await acceptInvitation({ password: "Outra frase de senha segura" }),
    );
    expect(
      await password.compare(validPassword, (await findUser()).password_hash),
    ).toBe(true);
  });

  test("Rejects an invitation for a disabled user", async () => {
    await database.query({
      text: "UPDATE users SET status = 'inactive' WHERE id = $1;",
      values: [user.id],
    });
    await expectValidationError(await acceptInvitation());
    expect((await findUser()).status).toBe("inactive");
    expect((await findInvitation()).used_at).toBeNull();
  });

  test("Ignores attempts to change the target user or grant another role", async () => {
    const otherUser = await orchestrator.createUser();
    const response = await acceptInvitation({
      user_id: otherUser.id,
      role: "platform_admin",
      status: "inactive",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(user.id);
    expect(body.role).toBe("technician");
    const other = await database.query({
      text: "SELECT status FROM users WHERE id = $1;",
      values: [otherUser.id],
    });
    expect(other.rows[0].status).toBe("invited");
  });

  test("Allows a new attempt after an invalid password", async () => {
    await expectValidationError(await acceptInvitation({ password: "short" }));
    expect((await acceptInvitation()).status).toBe(200);
  });

  test("Accepts only one of two simultaneous requests", async () => {
    const responses = await Promise.all([
      acceptInvitation(),
      acceptInvitation(),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    expect((await findUser()).status).toBe("active");
  });

  test.each(["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "Rejects %s without consuming the invitation",
    async (method) => {
      const response = await fetch(endpoint, { method });
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.text();
      const expectedBody =
        method === "HEAD"
          ? ""
          : JSON.stringify({
              name: "MethodNotAllowedError",
              message: "Método HTTP não permitido para este recurso.",
              action: "Utilize um dos métodos indicados no cabeçalho Allow.",
              status_code: 405,
            });
      expect(body).toBe(expectedBody);
      expect((await findUser()).status).toBe("invited");
      expect((await findInvitation()).used_at).toBeNull();
    },
  );
});
