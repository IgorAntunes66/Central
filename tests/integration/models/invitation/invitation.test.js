import { createHash } from "node:crypto";
import invitation from "models/invitation";
import password from "models/password";
import database from "infra/database";
import { ValidationError } from "infra/errors";
import orchestrator from "tests/orchestrator";

const validPassword = "Uma frase de senha segura";
let user;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await database.query("DELETE FROM users;");
  user = await orchestrator.createUser();
});

async function findUser() {
  const result = await database.query({
    text: "SELECT * FROM users WHERE id = $1;",
    values: [user.id],
  });
  return result.rows[0];
}

async function findInvitation(id) {
  const result = await database.query({
    text: "SELECT * FROM user_invitations WHERE id = $1;",
    values: [id],
  });
  return result.rows[0];
}

describe("models/invitation", () => {
  test("Creates a 24-hour invitation storing only its token hash", async () => {
    const created = await invitation.create(user.id);
    const stored = await findInvitation(created.id);
    expect(created.token).toMatch(/^[0-9a-f]{64}$/);
    expect(created.user_id).toBe(user.id);
    expect(created.expires_at.getTime() - created.created_at.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(stored.token_hash).toBe(
      createHash("sha256").update(created.token).digest("hex"),
    );
    expect(stored).not.toHaveProperty("token");
    expect(stored.used_at).toBeNull();
    expect((await findUser()).status).toBe("invited");
  });

  test("Replaces the previous unused invitation when issuing another", async () => {
    const first = await invitation.create(user.id);
    const second = await invitation.create(user.id);
    expect(first.token).not.toBe(second.token);
    expect(await findInvitation(first.id)).toBeUndefined();
    await expect(
      invitation.accept({ token: first.token, password: validPassword }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      (
        await invitation.accept({
          token: second.token,
          password: validPassword,
        })
      ).status,
    ).toBe("active");
  });

  test.each([undefined, null, 123, "invalid"])(
    "Rejects an invalid user identifier: %p",
    async (id) => {
      await expect(invitation.create(id)).rejects.toBeInstanceOf(
        ValidationError,
      );
    },
  );

  test("Rejects a user that does not exist", async () => {
    await expect(
      invitation.create("00000000-0000-4000-8000-000000000001"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test.each(["active", "inactive"])(
    "Does not issue invitations for %s users",
    async (status) => {
      await database.query({
        text: "UPDATE users SET status = $1, password_hash = 'hash-fixture' WHERE id = $2;",
        values: [status, user.id],
      });
      await expect(invitation.create(user.id)).rejects.toBeInstanceOf(
        ValidationError,
      );
    },
  );

  test("Activates the user with a bcrypt hash and consumes the invitation", async () => {
    const created = await invitation.create(user.id);
    const activated = await invitation.accept({
      token: created.token,
      password: validPassword,
    });
    const storedUser = await findUser();
    expect(activated.id).toBe(user.id);
    expect(activated.status).toBe("active");
    expect(activated).not.toHaveProperty("password_hash");
    expect(activated).not.toHaveProperty("token");
    expect(
      await password.compare(validPassword, storedUser.password_hash),
    ).toBe(true);
    expect((await findInvitation(created.id)).used_at).toBeInstanceOf(Date);
  });

  test("Cannot reuse an invitation to change the password", async () => {
    const created = await invitation.create(user.id);
    await invitation.accept({ token: created.token, password: validPassword });
    await expect(
      invitation.accept({
        token: created.token,
        password: "Outra senha bem longa",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      await password.compare(validPassword, (await findUser()).password_hash),
    ).toBe(true);
  });

  test("Rejects expired invitations without activating the user", async () => {
    const created = await invitation.create(user.id);
    await database.query({
      text: "UPDATE user_invitations SET created_at = current_timestamp - interval '2 days', expires_at = current_timestamp - interval '1 day' WHERE id = $1;",
      values: [created.id],
    });
    await expect(
      invitation.accept({ token: created.token, password: validPassword }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await findUser()).status).toBe("invited");
    expect((await findInvitation(created.id)).used_at).toBeNull();
  });

  test("Does not activate a user disabled after the invitation was issued", async () => {
    const created = await invitation.create(user.id);
    await database.query({
      text: "UPDATE users SET status = 'inactive' WHERE id = $1;",
      values: [user.id],
    });
    await expect(
      invitation.accept({ token: created.token, password: validPassword }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await findUser()).status).toBe("inactive");
    expect((await findInvitation(created.id)).used_at).toBeNull();
  });

  test("Rolls back consumption if the password is invalid, allowing another attempt", async () => {
    const created = await invitation.create(user.id);
    await expect(
      invitation.accept({ token: created.token, password: "short" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await findInvitation(created.id)).used_at).toBeNull();
    expect((await findUser()).password_hash).toBeNull();
    expect(
      (
        await invitation.accept({
          token: created.token,
          password: validPassword,
        })
      ).status,
    ).toBe("active");
  });

  test.each([
    undefined,
    null,
    {},
    { token: 123 },
    { token: "invalid" },
    { token: "a".repeat(64) },
  ])("Rejects invalid or unknown invitations: %p", async (data) => {
    await expect(invitation.accept(data)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await findUser()).status).toBe("invited");
  });

  test("Allows only one of two simultaneous acceptance attempts", async () => {
    const created = await invitation.create(user.id);
    const results = await Promise.allSettled([
      invitation.accept({ token: created.token, password: validPassword }),
      invitation.accept({
        token: created.token,
        password: "Outra senha bem longa",
      }),
    ]);
    const successful = results.filter(
      (result) => result.status === "fulfilled",
    );
    expect(successful).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected").reason,
    ).toBeInstanceOf(ValidationError);
    const winningPassword =
      results[0].status === "fulfilled"
        ? validPassword
        : "Outra senha bem longa";
    expect(
      await password.compare(winningPassword, (await findUser()).password_hash),
    ).toBe(true);
  });

  test("Keeps only one valid invitation after simultaneous issuance", async () => {
    const created = await Promise.all([
      invitation.create(user.id),
      invitation.create(user.id),
    ]);
    const stored = await database.query({
      text: "SELECT * FROM user_invitations WHERE user_id = $1;",
      values: [user.id],
    });
    expect(stored.rows).toHaveLength(1);
    const valid = created.find((item) => item.id === stored.rows[0].id);
    expect(
      (await invitation.accept({ token: valid.token, password: validPassword }))
        .status,
    ).toBe("active");
  });
});
