import database from "infra/database";
import orchestrator from "tests/orchestrator";

let client;
let companyId;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  client = await database.getNewClient();
  await client.query("BEGIN");
  const result = await client.query(
    "INSERT INTO companies (name, cnpj, ctr) VALUES ('Empresa teste', '12345678000195', '365/23') RETURNING id",
  );
  companyId = result.rows[0].id;
});

afterEach(async () => {
  try {
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

async function insertUser(overrides = {}) {
  const user = {
    name: "Usuário teste",
    email: "usuario@example.test",
    role: "technician",
    companyId: null,
    passwordHash: null,
    status: "invited",
    ...overrides,
  };
  const result = await client.query(
    `INSERT INTO users (name, email, role, company_id, password_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      user.name,
      user.email,
      user.role,
      user.companyId,
      user.passwordHash,
      user.status,
    ],
  );
  return result.rows[0];
}

describe("Users migration", () => {
  test.each([
    "platform_admin",
    "technician",
    "company_admin",
    "company_member",
  ])(
    "Allows an invited %s with the appropriate company relationship",
    async (role) => {
      const company = role.startsWith("company_") ? companyId : null;
      const user = await insertUser({ role, companyId: company });
      expect(user.company_id).toBe(company);
      expect(user.password_hash).toBeNull();
      expect(user.status).toBe("invited");
      expect(user.id).toEqual(expect.any(String));
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    },
  );

  test.each([
    "platform_admin",
    "technician",
    "company_admin",
    "company_member",
  ])("Rejects an incompatible company relationship for %s", async (role) => {
    const company = role.startsWith("company_") ? null : companyId;
    await expect(
      insertUser({ role, companyId: company }),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "users_role_company_check",
    });
  });

  test("Rejects duplicate login emails", async () => {
    await insertUser();
    await expect(insertUser()).rejects.toMatchObject({ code: "23505" });
  });

  test("Rejects a company that does not exist", async () => {
    await expect(
      insertUser({
        role: "company_member",
        companyId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "23503" });
  });

  test("Rejects activation before a password is set", async () => {
    await expect(insertUser({ status: "active" })).rejects.toMatchObject({
      code: "23514",
      constraint: "users_active_password_check",
    });
  });

  test("Allows activation with a password hash", async () => {
    const user = await insertUser({
      status: "active",
      passwordHash: "hash-fixture",
    });
    expect(user.status).toBe("active");
  });

  test.each([
    { name: " " },
    { email: "Usuario@example.test" },
    { email: " usuario@example.test " },
    { role: "unknown" },
    { status: "unknown" },
    { passwordHash: " " },
  ])("Rejects invalid fields: %j", async (fields) => {
    await expect(insertUser(fields)).rejects.toMatchObject({ code: "23514" });
  });
});
