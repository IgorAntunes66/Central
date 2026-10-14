import smoke from "../../smoke/request.js";

const originalBaseUrl = process.env.TEST_BASE_URL;
const originalSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

beforeEach(() => {
  process.env.TEST_BASE_URL = "https://preview.example.test";
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "test-secret";
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalBaseUrl === undefined) {
    delete process.env.TEST_BASE_URL;
  } else {
    process.env.TEST_BASE_URL = originalBaseUrl;
  }
  if (originalSecret === undefined) {
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  } else {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalSecret;
  }
});

describe("Smoke HTTP requests", () => {
  test("Sends the bypass in a header and rejects redirects", async () => {
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ status: 200 });

    await smoke.request("/api/v1/status");

    expect(fetch).toHaveBeenCalledWith(
      new URL("https://preview.example.test/api/v1/status"),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-vercel-protection-bypass": "test-secret",
        },
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
  });

  test("Supports public deployments without a bypass secret", async () => {
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ status: 200 });

    await smoke.request("/api/v1/status", "HEAD");

    expect(fetch.mock.calls[0][1].headers).toEqual({
      Accept: "application/json",
    });
    expect(fetch.mock.calls[0][1].method).toBe("HEAD");
  });

  test.each([
    "",
    "http://remote.example.test",
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test?token=secret",
  ])("Rejects an unsafe or missing base URL: %s", async (url) => {
    process.env.TEST_BASE_URL = url;
    const fetch = jest.spyOn(globalThis, "fetch");

    await expect(smoke.request("/api/v1/status")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("Rejects requests to another origin before sending the bypass", async () => {
    const fetch = jest.spyOn(globalThis, "fetch");

    await expect(
      smoke.request("https://other.example.test/status"),
    ).rejects.toThrow("A requisição deve permanecer em TEST_BASE_URL.");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("Rejects write methods", async () => {
    const fetch = jest.spyOn(globalThis, "fetch");

    await expect(smoke.request("/api/v1/migrations", "POST")).rejects.toThrow(
      "Os testes de smoke permitem apenas GET e HEAD.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
