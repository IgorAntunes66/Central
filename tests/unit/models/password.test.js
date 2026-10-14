import bcrypt from "bcrypt";
import password from "models/password";
import { ValidationError } from "infra/errors";

const validPassword = "Uma frase de senha segura";
let hash;

beforeAll(async () => {
  hash = await password.hash(validPassword);
});

describe("models/password", () => {
  test("Creates a bcrypt hash with the configured cost", () => {
    expect(hash).not.toBe(validPassword);
    expect(bcrypt.getRounds(hash)).toBe(4);
  });

  test.each([
    ["development", 4],
    ["test", 4],
    ["production", 12],
    [undefined, 12],
  ])("Uses the correct cost in environment %p", async (environment, cost) => {
    const originalEnvironment = process.env.NODE_ENV;
    try {
      if (environment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = environment;
      }
      const storedHash = await password.hash(validPassword);
      expect(bcrypt.getRounds(storedHash)).toBe(cost);
      expect(await password.compare(validPassword, storedHash)).toBe(true);
    } finally {
      if (originalEnvironment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalEnvironment;
      }
    }
  });

  test("Generates a different salt for each hash of the same password", async () => {
    const secondHash = await password.hash(validPassword);
    expect(secondHash).not.toBe(hash);
    expect(await password.compare(validPassword, secondHash)).toBe(true);
  });

  test("Matches the correct password and rejects a different one", async () => {
    expect(await password.compare(validPassword, hash)).toBe(true);
    expect(await password.compare("Outra frase de senha", hash)).toBe(false);
  });

  test("Preserves spaces and case", async () => {
    const value = " Minha senha com espaços ";
    const storedHash = await password.hash(value);
    expect(await password.compare(value, storedHash)).toBe(true);
    expect(await password.compare(value.trim(), storedHash)).toBe(false);
    expect(await password.compare(value.toLowerCase(), storedHash)).toBe(false);
  });

  test.each(["a".repeat(12), "a".repeat(72), "é".repeat(36), "🔐".repeat(18)])(
    "Accepts a password at the supported boundaries: %p",
    async (value) => {
      const storedHash = await password.hash(value);
      expect(await password.compare(value, storedHash)).toBe(true);
    },
  );

  test.each([
    undefined,
    null,
    123,
    {},
    [],
    "",
    "a".repeat(11),
    "🔐".repeat(11),
  ])("Rejects an invalid or short password: %p", async (value) => {
    await expect(password.hash(value)).rejects.toBeInstanceOf(ValidationError);
  });

  test.each(["a".repeat(73), "é".repeat(37), "🔐".repeat(19)])(
    "Rejects passwords exceeding 72 bytes: %p",
    async (value) => {
      await expect(password.hash(value)).rejects.toMatchObject({
        name: "ValidationError",
        message: "A senha deve conter no máximo 72 bytes.",
      });
    },
  );

  test("Does not authenticate a longer password sharing the same first 72 bytes", async () => {
    const value = "a".repeat(72);
    const storedHash = await password.hash(value);
    expect(await password.compare(`${value}b`, storedHash)).toBe(false);
  });

  test.each([undefined, null, 123, {}, ""])(
    "Returns false for an invalid password during comparison: %p",
    async (value) => {
      expect(await password.compare(value, hash)).toBe(false);
    },
  );

  test.each([undefined, null, 123, {}, "", "invalid-hash"])(
    "Returns false when the stored hash is absent or invalid: %p",
    async (storedHash) => {
      expect(await password.compare(validPassword, storedHash)).toBe(false);
    },
  );
});
