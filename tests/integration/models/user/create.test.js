import user from "models/user";
import company from "models/company";
import database from "infra/database";
import { ConflictError, ValidationError } from "infra/errors";
import orchestrator from "tests/orchestrator";

let companyId;

async function countUsers() {
  const result = await database.query(
    "SELECT count(*)::int AS count FROM users;",
  );
  return result.rows[0].count;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await database.query("DELETE FROM users;");
  await database.query("DELETE FROM companies;");
  const created = await company.create({
    name: "Empresa Exemplo",
    cnpj: "11222333000181",
    ctr: "005/03",
  });
  companyId = created.id;
});

describe("models/user.create", () => {
  test.each([
    "platform_admin",
    "technician",
    "company_admin",
    "company_member",
  ])(
    "Creates an invited %s with the appropriate company relationship",
    async (role) => {
      const company = role.startsWith("company_") ? companyId : null;
      const created = await user.create(
        orchestrator.createUserData({
          role,
          company_id: company,
        }),
      );
      expect(created).toMatchObject({
        name: "Usuário Exemplo",
        email: expect.any(String),
        role,
        company_id: company,
        status: "invited",
      });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toEqual(created.created_at);
      expect(created).not.toHaveProperty("password_hash");
      const result = await database.query({
        text: "SELECT * FROM users WHERE id = $1;",
        values: [created.id],
      });
      expect(result.rows[0]).toEqual({ ...created, password_hash: null });
    },
  );

  test("Normalizes name and login email without changing the supplied object", async () => {
    const data = {
      role: "technician",
      name: " Usuário Exemplo ",
      email: " Usuario@EXAMPLE.com ",
    };
    const original = { ...data };
    const created = await user.create(data);
    expect(data).toEqual(original);
    expect(created.name).toBe("Usuário Exemplo");
    expect(created.email).toBe("usuario@example.com");
  });

  test("Accepts a login email at its maximum supported length", async () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    expect(email).toHaveLength(254);
    expect(
      (await user.create(orchestrator.createUserData({ email }))).email,
    ).toBe(email);
  });

  test("Keeps passwords and generated defaults outside the creation input", async () => {
    const created = await user.create(
      orchestrator.createUserData({
        id: "invalid",
        status: "active",
        password: "password-fixture",
        password_hash: "hash-fixture",
        created_at: "invalid",
        updated_at: "invalid",
      }),
    );
    expect(created.status).toBe("invited");
    expect(created).not.toHaveProperty("password");
    expect(created).not.toHaveProperty("password_hash");
    const result = await database.query({
      text: "SELECT password_hash FROM users WHERE id = $1;",
      values: [created.id],
    });
    expect(result.rows[0].password_hash).toBeNull();
  });

  test.each([
    ["name", undefined],
    ["name", null],
    ["name", " "],
    ["name", 123],
    ["name", "bad\0name"],
    ["email", undefined],
    ["email", null],
    ["email", " "],
    ["email", 123],
    ["email", "invalid"],
    ["email", "bad\0@example.com"],
    ["email", "a".repeat(255) + "@example.com"],
    ["role", undefined],
    ["role", "unknown"],
    ["role", 123],
    ["company_id", ""],
    ["company_id", 123],
    ["company_id", "00000000-0000-0000-0000-000000000000"],
  ])(
    "Rejects invalid %s: %p without inserting a user",
    async (field, value) => {
      await expect(
        user.create(orchestrator.createUserData({ [field]: value })),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await countUsers()).toBe(0);
    },
  );

  test.each([null, undefined, [], "user"])(
    "Rejects invalid input: %p",
    async (data) => {
      await expect(user.create(data)).rejects.toBeInstanceOf(ValidationError);
      expect(await countUsers()).toBe(0);
    },
  );

  test.each(["platform_admin", "technician"])(
    "Rejects a company relationship for %s",
    async (role) => {
      await expect(
        user.create(
          orchestrator.createUserData({ role, company_id: companyId }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await countUsers()).toBe(0);
    },
  );

  test.each([undefined, null, "", "invalid", 123])(
    "Requires a valid company identifier for client users: %p",
    async (company_id) => {
      await expect(
        user.create(
          orchestrator.createUserData({ role: "company_member", company_id }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await countUsers()).toBe(0);
    },
  );

  test("Rejects a company that does not exist", async () => {
    await expect(
      user.create(
        orchestrator.createUserData({
          role: "company_admin",
          company_id: "00000000-0000-4000-8000-000000000001",
        }),
      ),
    ).rejects.toMatchObject({
      name: "ValidationError",
      statusCode: 400,
      message: "A empresa informada não está cadastrada.",
    });
    expect(await countUsers()).toBe(0);
  });

  test("Rejects duplicate login emails regardless of case and company", async () => {
    await orchestrator.createUser({ email: "usuario@example.com" });
    await expect(
      user.create(
        orchestrator.createUserData({
          role: "company_member",
          company_id: companyId,
          email: " USUARIO@EXAMPLE.COM ",
        }),
      ),
    ).rejects.toMatchObject({
      name: "ConflictError",
      statusCode: 409,
      message: "Já existe um usuário com este e-mail.",
    });
    expect(await countUsers()).toBe(1);
  });

  test("Handles simultaneous registrations using the database uniqueness constraint", async () => {
    const results = await Promise.allSettled([
      user.create(orchestrator.createUserData({ email: "same@example.com" })),
      user.create(orchestrator.createUserData({ email: "same@example.com" })),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected").reason,
    ).toBeInstanceOf(ConflictError);
    expect(await countUsers()).toBe(1);
  });

  test("Persists SQL-like text as data", async () => {
    const name = "Usuário'); DROP TABLE users; --";
    const created = await user.create(orchestrator.createUserData({ name }));
    expect(created.name).toBe(name);
    expect(await countUsers()).toBe(1);
  });
});
