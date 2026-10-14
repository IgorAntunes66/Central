import { renderToStaticMarkup } from "react-dom/server";
import useSWR from "swr";
import StatusPage from "pages/status";

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }));

const data = {
  updated_at: "2026-10-14T12:00:00.000Z",
  dependencies: {
    database: { version: "18", max_connections: 100, opened_connections: 1 },
    email: { connected: true },
    mailcatcher: {
      connected: true,
      web_url: "http://127.0.0.1:1080",
      captured_messages: 0,
      version: null,
    },
  },
};

beforeEach(() => {
  useSWR.mockReset();
});

describe("Status page", () => {
  test("Shows local service details, including an empty inbox", () => {
    useSWR.mockReturnValue({ data, isLoading: false });
    const html = renderToStaticMarkup(<StatusPage />);

    expect(html).toContain("Tudo funcionando por aqui.");
    expect(html).toContain("Interface HTTP");
    expect(html).toContain("Mensagens capturadas");
    expect(html).toContain("<dd>0</dd>");
    expect(html).toContain("Não informada pelo serviço");
    expect(html).toContain('href="http://127.0.0.1:1080"');
  });

  test("Shows SMTP failure while preserving the database diagnostics", () => {
    useSWR.mockReturnValue({
      data: {
        ...data,
        dependencies: { ...data.dependencies, email: { connected: false } },
      },
    });
    const html = renderToStaticMarkup(<StatusPage />);

    expect(html).toContain("Um serviço precisa de atenção.");
    expect(html).toContain("<dd>Indisponível</dd>");
    expect(html).toContain("Conexões máximas");
    expect(html).toContain("<dd>100</dd>");
  });

  test("Omits the local section when MailCatcher is absent", () => {
    useSWR.mockReturnValue({
      data: {
        ...data,
        dependencies: {
          database: data.dependencies.database,
          email: data.dependencies.email,
        },
      },
    });
    expect(renderToStaticMarkup(<StatusPage />)).not.toContain("MailCatcher");
  });

  test("Displays a readable error when the status request fails", () => {
    useSWR.mockReturnValue({
      error: new Error("Request failed"),
      isLoading: false,
    });
    expect(renderToStaticMarkup(<StatusPage />)).toContain(
      "Não foi possível consultar o status dos serviços.",
    );
  });

  test("Does not report stale service data as currently available", () => {
    useSWR.mockReturnValue({
      data,
      error: new Error("Connection failed"),
      isLoading: false,
    });
    const html = renderToStaticMarkup(<StatusPage />);

    expect(html).toContain("última consulta válida");
    expect(html).toContain("Não verificado");
    expect(html).not.toContain("Tudo funcionando por aqui.");
    expect(html).not.toContain("<dd>Disponível</dd>");
  });

  test("Keeps the page visible and disables refresh while checking", () => {
    useSWR.mockReturnValue({ data, isLoading: false, isValidating: true });
    const html = renderToStaticMarkup(<StatusPage />);

    expect(html).toContain("Atualizando…");
    expect(html).toContain('disabled=""');
    expect(html).toContain("PostgreSQL 18");
  });

  test("Shows the initial loading state without reporting healthy services", () => {
    useSWR.mockReturnValue({ isLoading: true, isValidating: true });
    const html = renderToStaticMarkup(<StatusPage />);

    expect(html).toContain("Consultando os serviços…");
    expect(html).toContain("Carregando...");
    expect(html).not.toContain("Operacional");
  });
});
