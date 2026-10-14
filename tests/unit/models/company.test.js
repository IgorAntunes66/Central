import company from "models/company";
import database from "infra/database";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Company database failures", () => {
  test.each([
    new Error("Connection failed"),
    Object.assign(new Error("Unexpected unique constraint"), {
      code: "23505",
      constraint: "companies_pkey",
    }),
  ])("Preserves unexpected failures: %p", async (error) => {
    jest.spyOn(database, "query").mockRejectedValue(error);

    await expect(
      company.create({
        name: "Empresa Exemplo",
        cnpj: "11222333000181",
        ctr: "005/03",
      }),
    ).rejects.toBe(error);
  });
});
