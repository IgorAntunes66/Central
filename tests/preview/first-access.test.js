import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  expect,
  test,
} from "@jest/globals";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Client } from "pg";
import bcrypt from "bcrypt";

let client;
let userId;
let token;
let baseUrl;
const password = "Uma frase de senha para homologação";

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin)
    throw new Error("A requisição deve permanecer no Preview.");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? {
            "x-vercel-protection-bypass":
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          }
        : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
}

beforeAll(async () => {
  if (
    process.env.TEST_DEPLOYMENT_ENV !== "preview" ||
    !process.env.PREVIEW_DATABASE_URL
  ) {
    throw new Error(
      "Configure o ambiente preview e PREVIEW_DATABASE_URL para o banco isolado de homologação.",
    );
  }
  baseUrl = new URL(process.env.TEST_BASE_URL);
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("TEST_BASE_URL deve ser a origem HTTPS do Preview.");
  }
  client = new Client({ connectionString: process.env.PREVIEW_DATABASE_URL });
  await client.connect();
});

beforeEach(async () => {
  userId = randomUUID();
  token = randomBytes(32).toString("hex");
  await client.query({
    text: "INSERT INTO users (id, name, email, role) VALUES ($1, 'Teste automático de homologação', $2, 'technician');",
    values: [userId, `preview-${userId}@example.test`],
  });
  await client.query({
    text: "INSERT INTO user_invitations (user_id, token_hash, expires_at) VALUES ($1, $2, current_timestamp + interval '24 hours');",
    values: [userId, createHash("sha256").update(token).digest("hex")],
  });
});

afterEach(async () => {
  if (client && userId)
    await client.query({
      text: "DELETE FROM users WHERE id = $1;",
      values: [userId],
    });
});

afterAll(async () => {
  await client?.end();
});

describe("First access in isolated Preview", () => {
  test("Opens the emailed link, defines the password and refuses reuse", async () => {
    const page = await request(`/primeiro-acesso?token=${token}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await page.text()).toContain('id="password"');
    const response = await request("/api/v1/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: userId,
      status: "active",
    });
    const stored = await client.query({
      text: "SELECT password_hash FROM users WHERE id = $1;",
      values: [userId],
    });
    expect(bcrypt.getRounds(stored.rows[0].password_hash)).toBe(12);
    expect(await bcrypt.compare(password, stored.rows[0].password_hash)).toBe(
      true,
    );
    const repeated = await request("/api/v1/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    expect(repeated.status).toBe(400);
  });

  test("Refuses an expired invitation without activating the account", async () => {
    await client.query({
      text: "UPDATE user_invitations SET created_at = current_timestamp - interval '2 days', expires_at = current_timestamp - interval '1 day' WHERE user_id = $1;",
      values: [userId],
    });
    const response = await request("/api/v1/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    expect(response.status).toBe(400);
    const stored = await client.query({
      text: "SELECT status, password_hash FROM users WHERE id = $1;",
      values: [userId],
    });
    expect(stored.rows[0]).toEqual({ status: "invited", password_hash: null });
  });
});
