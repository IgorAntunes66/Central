import company from "models/company";
import database from "infra/database";
import { ValidationError, ConflictError } from "infra/errors";
import orchestrator from "tests/orchestrator";

function companyData(overrides = {}) {
  return {
    name: "Empresa Exemplo",
    cnpj: "11222333000181",
    ctr: "005/03",
    ...overrides,
  };
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await database.query("DELETE FROM companies;");
});

describe("models/company.create", () => {
  test.each([undefined, null, "", "   "])(
    "Stores empty optional fields as null: %p",
    async (value) => {
      const optionalFields = {
        email: value,
        phone: value,
        address_zip_code: value,
        address_state: value,
        address_street: value,
        address_number: value,
        address_complement: value,
        address_neighborhood: value,
        address_city: value,
      };
      const created = await company.create(companyData(optionalFields));

      for (const field of Object.keys(optionalFields)) {
        expect(created[field]).toBeNull();
      }
    },
  );

  test("Accepts contact fields at their maximum supported lengths", async () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    expect(email).toHaveLength(254);
    const created = await company.create(
      companyData({ email, phone: "+123456789012345" }),
    );
    expect(created.email).toBe(email);
    expect(created.phone).toBe("+123456789012345");
  });

  test("Persists SQL-like text as data", async () => {
    const name = "Empresa'); DROP TABLE companies; --";
    const created = await company.create(companyData({ name }));
    expect(created.name).toBe(name);
    const result = await database.query(
      "SELECT count(*)::int AS count FROM companies;",
    );
    expect(result.rows[0].count).toBe(1);
  });

  test("Rejects an existing alphanumeric CNPJ regardless of case", async () => {
    await company.create(companyData({ cnpj: "12ABC34501DE35" }));
    await expect(
      company.create(
        companyData({ cnpj: "12.abc.345/01de-35", ctr: "006/03" }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("Persists the company with generated defaults and optional fields", async () => {
    const created = await company.create(companyData());
    const result = await database.query({
      text: "SELECT * FROM companies WHERE id = $1;",
      values: [created.id],
    });
    expect(result.rows).toEqual([created]);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.status).toBe("active");
    expect(created.created_at).toBeInstanceOf(Date);
    expect(created.updated_at).toEqual(created.created_at);
    expect(created.email).toBeNull();
    expect(created.phone).toBeNull();
    expect(created.address_street).toBeNull();
    expect(created.ctr).toBe("005/03");
  });

  test("Normalizes contact and address without changing the supplied object", async () => {
    const data = companyData({
      name: "  Empresa Exemplo  ",
      cnpj: "11.222.333/0001-81",
      email: " contato+empresa@example.com ",
      phone: "+55 (65) 99999-1234",
      address_zip_code: "78000-000",
      address_street: " Rua Central ",
      address_number: "S/N",
      address_complement: "  ",
      address_neighborhood: " Centro ",
      address_city: " Cuiabá ",
      address_state: "mt",
    });
    const original = { ...data };
    const created = await company.create(data);
    expect(data).toEqual(original);
    expect(created).toMatchObject({
      name: "Empresa Exemplo",
      cnpj: "11222333000181",
      email: "contato+empresa@example.com",
      phone: "+5565999991234",
      address_zip_code: "78000000",
      address_street: "Rua Central",
      address_number: "S/N",
      address_complement: null,
      address_neighborhood: "Centro",
      address_city: "Cuiabá",
      address_state: "MT",
    });
  });

  test("Accepts and normalizes an alphanumeric CNPJ with valid check digits", async () => {
    const created = await company.create(
      companyData({ cnpj: "12.abc.345/01de-35" }),
    );
    expect(created.cnpj).toBe("12ABC34501DE35");
  });

  test("Keeps defaults controlled by the database", async () => {
    const created = await company.create(
      companyData({
        id: "invalid",
        status: "inactive",
        created_at: "invalid",
        updated_at: "invalid",
      }),
    );
    expect(created.status).toBe("active");
    expect(created.id).not.toBe("invalid");
    expect(created.created_at).toBeInstanceOf(Date);
  });

  test.each([
    ["name", undefined],
    ["name", " "],
    ["name", 123],
    ["name", "bad\0name"],
    ["cnpj", null],
    ["cnpj", "11222333000182"],
    ["cnpj", "00000000000000"],
    ["cnpj", "12345678909"],
    ["cnpj", "12ABC34501DE34"],
    ["cnpj", "12@BC34501DE35"],
    ["ctr", null],
    ["ctr", "5/03"],
    ["ctr", "005-03"],
    ["ctr", 503],
    ["email", "invalid"],
    ["email", "a".repeat(255) + "@example.com"],
    ["phone", "65999991234"],
    ["phone", "+0123456"],
    ["phone", "+1234567890123456"],
    ["address_zip_code", "1234567"],
    ["address_zip_code", 78000000],
    ["address_state", "XX"],
    ["address_state", "Mato Grosso"],
    ["address_street", {}],
    ["address_number", 15],
    ["address_city", "bad\0city"],
  ])(
    "Rejects invalid %s: %p without inserting a company",
    async (field, value) => {
      await expect(
        company.create(companyData({ [field]: value })),
      ).rejects.toBeInstanceOf(ValidationError);
      const result = await database.query(
        "SELECT count(*)::int AS count FROM companies;",
      );
      expect(result.rows[0].count).toBe(0);
    },
  );

  test.each([null, undefined, [], "company"])(
    "Rejects invalid input: %p",
    async (data) => {
      await expect(company.create(data)).rejects.toBeInstanceOf(
        ValidationError,
      );
    },
  );

  test("Rejects an existing CNPJ even when supplied with punctuation", async () => {
    await company.create(companyData());
    await expect(
      company.create(
        companyData({ cnpj: "11.222.333/0001-81", ctr: "006/03" }),
      ),
    ).rejects.toMatchObject({
      name: "ConflictError",
      statusCode: 409,
      message: "Já existe uma empresa com este CNPJ.",
    });
  });

  test("Rejects an existing CTR", async () => {
    await company.create(companyData());
    await expect(
      company.create(companyData({ cnpj: "11444777000161" })),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: "Já existe uma empresa com este CTR.",
    });
  });

  test("Allows companies with the same name and contact email", async () => {
    await company.create(companyData({ email: "contact@example.com" }));
    const created = await company.create(
      companyData({
        cnpj: "11444777000161",
        ctr: "006/03",
        email: "contact@example.com",
      }),
    );
    expect(created.email).toBe("contact@example.com");
  });

  test("Handles simultaneous registrations through the database uniqueness constraint", async () => {
    const results = await Promise.allSettled([
      company.create(companyData()),
      company.create(companyData()),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    const result = await database.query(
      "SELECT count(*)::int AS count FROM companies;",
    );
    expect(result.rows[0].count).toBe(1);
  });
});
