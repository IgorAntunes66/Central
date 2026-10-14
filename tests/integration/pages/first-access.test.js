import database from "infra/database";
import invitation from "models/invitation";
import orchestrator from "tests/orchestrator";

let created;
let user;

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

async function openPage(query = `?token=${created.token}`) {
  return fetch(`http://localhost:3000/primeiro-acesso${query}`);
}

async function expectInvalidPage(query) {
  const response = await openPage(query);
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain("Precisamos de um novo convite.");
  expect(body).not.toContain('id="password"');
  const pageData = JSON.parse(
    body.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)[1],
  );
  expect(pageData.props.pageProps.token).toBeNull();
}

describe("First access page", () => {
  test("Shows the form without consuming the invitation or exposing user details", async () => {
    const response = await openPage();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store|no-cache/);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const body = await response.text();
    expect(body).toContain("Primeiro acesso | Central");
    expect(body).toContain('id="password"');
    expect(body).toContain('id="confirmation"');
    expect(body).toContain('name="robots" content="noindex, nofollow"');
    expect(body).not.toContain(user.email);
    expect(await invitation.isValid(created.token)).toBe(true);
  });

  test.each([
    "",
    "?token=invalid",
    `?token=${"a".repeat(64)}`,
    "?token=one&token=two",
  ])("Rejects missing, malformed or unknown invitations: %p", async (query) => {
    expect.assertions(4);
    await expectInvalidPage(query);
  });

  test("Does not show the form for an expired invitation", async () => {
    await database.query({
      text: "UPDATE user_invitations SET created_at = current_timestamp - interval '2 days', expires_at = current_timestamp - interval '1 day' WHERE id = $1;",
      values: [created.id],
    });
    expect.assertions(4);
    await expectInvalidPage(`?token=${created.token}`);
  });

  test("Does not show the form after an invitation was accepted", async () => {
    await invitation.accept({
      token: created.token,
      password: "Uma frase de senha segura",
    });
    expect.assertions(4);
    await expectInvalidPage(`?token=${created.token}`);
  });

  test("Does not show the form for a disabled user", async () => {
    await database.query({
      text: "UPDATE users SET status = 'inactive' WHERE id = $1;",
      values: [user.id],
    });
    expect.assertions(4);
    await expectInvalidPage(`?token=${created.token}`);
  });
});
