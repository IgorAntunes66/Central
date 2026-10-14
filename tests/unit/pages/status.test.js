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

    expect(html).toContain("Conexão SMTP: Disponível");
    expect(html).toContain("Interface HTTP: Disponível");
    expect(html).toContain("Mensagens capturadas: 0");
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

    expect(html).toContain("Conexão SMTP: Indisponível");
    expect(html).toContain("Conexões máximas: 100");
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
});
