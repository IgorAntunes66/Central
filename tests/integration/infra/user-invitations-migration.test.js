import database from "infra/database";
import orchestrator from "tests/orchestrator";

let userId;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await database.query("DELETE FROM users;");
  const user = await orchestrator.createUser();
  userId = user.id;
});

async function insertInvitation(overrides = {}) {
  const invitation = {
    user_id: userId,
    token_hash: "a".repeat(64),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used_at: null,
    ...overrides,
  };
  const result = await database.query({
    text: `INSERT INTO user_invitations (user_id, token_hash, expires_at, used_at)
      VALUES ($1, $2, $3, $4) RETURNING *;`,
    values: [
      invitation.user_id,
      invitation.token_hash,
      invitation.expires_at,
      invitation.used_at,
    ],
  });
  return result.rows[0];
}

describe("User invitations migration", () => {
  test("Persists an unused invitation with its user, hash and expiration", async () => {
    const invitation = await insertInvitation();
    expect(invitation).toMatchObject({
      user_id: userId,
      token_hash: "a".repeat(64),
      used_at: null,
    });
    expect(invitation.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(invitation.created_at).toBeInstanceOf(Date);
    expect(invitation.expires_at.getTime()).toBeGreaterThan(
      invitation.created_at.getTime(),
    );
  });

  test("Rejects duplicate token hashes, including across users", async () => {
    await insertInvitation();
    const anotherUser = await orchestrator.createUser();
    await expect(
      insertInvitation({ user_id: anotherUser.id }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  test("Rejects a user that does not exist", async () => {
    await expect(
      insertInvitation({ user_id: "00000000-0000-4000-8000-000000000001" }),
    ).rejects.toMatchObject({ code: "23503" });
  });

  test.each([{ user_id: null }, { token_hash: null }, { expires_at: null }])(
    "Requires mandatory fields: %j",
    async (overrides) => {
      await expect(insertInvitation(overrides)).rejects.toMatchObject({
        code: "23502",
      });
    },
  );

  test.each(["", "a".repeat(63), "A".repeat(64), "g".repeat(64)])(
    "Rejects invalid token hashes: %p",
    async (token_hash) => {
      await expect(insertInvitation({ token_hash })).rejects.toMatchObject({
        code: "23514",
      });
    },
  );

  test("Requires expiration after creation", async () => {
    await expect(
      insertInvitation({ expires_at: new Date(0) }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("Rejects a usage date before creation", async () => {
    await expect(
      insertInvitation({ used_at: new Date(0) }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("Records when an invitation was used", async () => {
    const invitation = await insertInvitation();
    const result = await database.query({
      text: "UPDATE user_invitations SET used_at = current_timestamp WHERE id = $1 RETURNING used_at;",
      values: [invitation.id],
    });
    expect(result.rows[0].used_at.getTime()).toBeGreaterThanOrEqual(
      invitation.created_at.getTime(),
    );
  });

  test("Removes invitations when their user is deleted", async () => {
    const invitation = await insertInvitation();
    await database.query({
      text: "DELETE FROM users WHERE id = $1;",
      values: [userId],
    });
    const result = await database.query({
      text: "SELECT id FROM user_invitations WHERE id = $1;",
      values: [invitation.id],
    });
    expect(result.rows).toEqual([]);
  });
});
