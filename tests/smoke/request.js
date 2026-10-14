function getBaseUrl() {
  if (!process.env.TEST_BASE_URL) {
    throw new Error("Informe TEST_BASE_URL para executar os testes de smoke.");
  }

  const url = new URL(process.env.TEST_BASE_URL);
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("TEST_BASE_URL deve ser uma origem HTTPS, ou HTTP local.");
  }
  return url;
}

async function request(path, method = "GET") {
  if (!["GET", "HEAD"].includes(method)) {
    throw new Error("Os testes de smoke permitem apenas GET e HEAD.");
  }

  const baseUrl = getBaseUrl();
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new Error("A requisição deve permanecer em TEST_BASE_URL.");
  }

  const headers = { Accept: "application/json" };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] =
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  return fetch(url, {
    method,
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
}

export default { request };
