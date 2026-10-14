import useSWR from "swr";

async function fetchAPI(key) {
  const response = await fetch(key);
  const body = await response.json();
  if (!response.ok && !(response.status === 503 && body.dependencies)) {
    throw new Error("Não foi possível consultar o status dos serviços.");
  }
  return body;
}

export default function StatusPage() {
  const { isLoading, data, error } = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 30000,
  });

  if (isLoading) {
    return (
      <>
        <h1>Status</h1>
        <p>Carregando...</p>
      </>
    );
  }
  if (error || !data?.dependencies) {
    return (
      <>
        <h1>Status</h1>
        <p role="alert">Não foi possível consultar o status dos serviços.</p>
      </>
    );
  }

  const { database, email, mailcatcher } = data.dependencies;
  let smtpStatus = "Indisponível";
  if (email.connected) smtpStatus = "Disponível";
  let mailcatcherStatus = "Indisponível";
  if (mailcatcher?.connected) mailcatcherStatus = "Disponível";

  return (
    <>
      <h1>Status</h1>
      <div>
        Última atualização: {new Date(data.updated_at).toLocaleString("pt-BR")}
      </div>
      <div>Atualização automática a cada 30 segundos.</div>
      <section>
        <h2>Banco de dados</h2>
        <div>Versão: {database.version}</div>
        <div>Conexões máximas: {database.max_connections}</div>
        <div>Conexões abertas: {database.opened_connections}</div>
      </section>
      <section>
        <h2>E-mail</h2>
        <div>Conexão SMTP: {smtpStatus}</div>
        <p>
          A verificação não envia mensagens nem confirma a entrega ao
          destinatário.
        </p>
      </section>
      {mailcatcher && (
        <section>
          <h2>MailCatcher — ambiente local</h2>
          <div>Interface HTTP: {mailcatcherStatus}</div>
          <div>
            Versão: {mailcatcher.version ?? "Não informada pelo serviço"}
          </div>
          <div>
            Mensagens capturadas:{" "}
            {mailcatcher.captured_messages ?? "Não disponível"}
          </div>
          <a href={mailcatcher.web_url} target="_blank" rel="noreferrer">
            Abrir caixa de entrada
          </a>
        </section>
      )}
    </>
  );
}
