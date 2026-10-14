import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import styles from "./status.module.css";

async function fetchAPI(key) {
  const response = await fetch(key);
  const body = await response.json();
  if (!response.ok && !(response.status === 503 && body.dependencies)) {
    throw new Error("Não foi possível consultar o status dos serviços.");
  }
  return body;
}

function getBadgeClass(connected, hasError) {
  if (hasError) return styles.unknown;
  if (connected) return styles.available;
  return styles.unavailable;
}

export default function StatusPage() {
  const { isLoading, data, error, mutate, isValidating } = useSWR(
    "/api/v1/status",
    fetchAPI,
    {
      refreshInterval: 30000,
    },
  );
  const dependencies = data?.dependencies;
  const database = dependencies?.database;
  const email = dependencies?.email;
  const mailcatcher = dependencies?.mailcatcher;
  const hasData = Boolean(database && email);
  const healthy =
    hasData && email.connected && (!mailcatcher || mailcatcher.connected);
  let headline = "Consultando os serviços…";
  let description = "Estamos verificando a disponibilidade da aplicação.";
  let statusLabel = "Verificando";
  let bannerClass = styles.checking;
  if (hasData && !error) {
    if (healthy) {
      headline = "Tudo funcionando por aqui.";
      description =
        "Os serviços monitorados estão disponíveis para atender você.";
      statusLabel = "Operacional";
      bannerClass = styles.healthy;
    } else {
      headline = "Um serviço precisa de atenção.";
      description =
        "Confira os detalhes abaixo para identificar a indisponibilidade.";
      statusLabel = "Atenção necessária";
      bannerClass = styles.degraded;
    }
  } else if (error || (!isLoading && !hasData)) {
    headline = "Não conseguimos verificar os serviços.";
    description = "Tente atualizar a página para consultar o status novamente.";
    statusLabel = "Consulta indisponível";
    bannerClass = styles.degraded;
  }

  let smtpStatus = "Indisponível";
  if (email?.connected) smtpStatus = "Disponível";
  let mailcatcherStatus = "Indisponível";
  if (mailcatcher?.connected) mailcatcherStatus = "Disponível";
  let databaseStatus = "Disponível";
  let liveLabel = "Atualização automática";
  if (isValidating) liveLabel = "Atualizando dados";
  if (error) {
    smtpStatus = "Não verificado";
    mailcatcherStatus = "Não verificado";
    databaseStatus = "Não verificado";
    liveLabel = "Consulta indisponível";
  }

  return (
    <>
      <Head>
        <title>Status dos serviços | Central</title>
        <meta name="application-name" content="Central" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta
          name="description"
          content="Acompanhe a disponibilidade dos serviços da Central."
        />
      </Head>
      <div className={styles.page}>
        <aside className={styles.sidebar}>
          <Link
            className={styles.brand}
            href="/status"
            aria-label="Central — página de status"
          >
            <span className={styles.brandMark}>
              c<span>·</span>
            </span>
            <span>
              central
              <span className={styles.brandSubtitle}>
                CUIDAR COMEÇA POR AQUI
              </span>
            </span>
          </Link>
          <div className={styles.navLabel}>VISIBILIDADE</div>
          <nav aria-label="Navegação">
            <Link href="/status" aria-current="page" className={styles.navItem}>
              <span className={styles.navIcon}>◉</span>Status dos serviços
              <span className={styles.navDot} />
            </Link>
          </nav>
          <div className={styles.sidebarNote}>
            <span className={styles.noteMark}>↗</span>
            <p>
              Uma visão clara.
              <br />
              Um atendimento melhor.
            </p>
            <span>
              Disponibilidade da aplicação,
              <br />
              em um só lugar.
            </span>
          </div>
        </aside>
        <main className={styles.main}>
          <header className={styles.topbar}>
            <span>
              <span className={styles.breadcrumb}>Central</span>
              <span className={styles.separator}>/</span>Status
            </span>
            <span
              className={`${styles.liveLabel} ${error ? styles.stale : ""}`}
            >
              <span className={styles.dot} />
              {liveLabel}
            </span>
          </header>
          <div className={styles.content}>
            <div className={styles.headingRow}>
              <div>
                <div className={styles.eyebrow}>
                  TRANSPARÊNCIA EM CADA CONEXÃO
                </div>
                <h1>Status dos serviços</h1>
                <p className={styles.subtitle}>
                  Acompanhe o que mantém a nossa operação em movimento.
                </p>
              </div>
              <button
                className={styles.refreshButton}
                onClick={() => mutate()}
                disabled={isLoading || isValidating}
                aria-label="Atualizar status"
              >
                <svg
                  className={isValidating ? styles.spinning : undefined}
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M20 7v5h-5M4 17v-5h5" />
                  <path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
                </svg>
                {isValidating ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
            <section
              className={`${styles.banner} ${bannerClass}`}
              aria-live="polite"
            >
              <div className={styles.bannerSymbol} aria-hidden="true">
                {healthy && !error ? "✓" : "·"}
              </div>
              <div>
                <span className={styles.bannerLabel}>{statusLabel}</span>
                <h2>{headline}</h2>
                <p>{description}</p>
              </div>
              <div className={styles.bannerDecoration} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
            {error && (
              <p className={styles.error} role="alert">
                Não foi possível consultar o status dos serviços.
                {hasData &&
                  " Os detalhes abaixo são da última consulta válida."}
              </p>
            )}
            {isLoading && <p className={styles.loading}>Carregando...</p>}
            {hasData && (
              <>
                <div className={styles.sectionHeading}>
                  <h2>
                    Serviços monitorados{" "}
                    <span>{Object.keys(dependencies).length}</span>
                  </h2>
                  {mailcatcher && (
                    <span className={styles.environment}>Ambiente local</span>
                  )}
                </div>
                <div className={styles.cards}>
                  <section className={styles.card}>
                    <div className={styles.cardTop}>
                      <div
                        className={`${styles.serviceIcon} ${styles.databaseIcon}`}
                      >
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden="true"
                        >
                          <ellipse cx="12" cy="5" rx="8" ry="3" />
                          <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                        </svg>
                      </div>
                      <span
                        className={`${styles.badge} ${getBadgeClass(true, error)}`}
                      >
                        <span className={styles.dot} />
                        {databaseStatus}
                      </span>
                    </div>
                    <h3>Banco de dados</h3>
                    <p className={styles.cardDescription}>
                      A base de cada atendimento.
                    </p>
                    <dl className={styles.details}>
                      <div>
                        <dt>Versão</dt>
                        <dd>PostgreSQL {database.version}</dd>
                      </div>
                      <div>
                        <dt>Conexões máximas</dt>
                        <dd>{database.max_connections}</dd>
                      </div>
                      <div>
                        <dt>Conexões abertas</dt>
                        <dd>{database.opened_connections}</dd>
                      </div>
                    </dl>
                    <div className={styles.cardFoot}>
                      <span className={styles.dot} />
                      {error
                        ? "Dados da última consulta válida"
                        : "Consulta ao banco concluída"}
                    </div>
                  </section>
                  <section className={styles.card}>
                    <div className={styles.cardTop}>
                      <div
                        className={`${styles.serviceIcon} ${styles.emailIcon}`}
                      >
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden="true"
                        >
                          <rect x="3" y="5" width="18" height="14" rx="3" />
                          <path d="m3 7 9 6 9-6" />
                        </svg>
                      </div>
                      <span
                        className={`${styles.badge} ${getBadgeClass(email.connected, error)}`}
                      >
                        <span className={styles.dot} />
                        {smtpStatus}
                      </span>
                    </div>
                    <h3>E-mail</h3>
                    <p className={styles.cardDescription}>
                      Conexões que aproximam pessoas.
                    </p>
                    <dl className={styles.details}>
                      <div>
                        <dt>Conexão SMTP</dt>
                        <dd>{smtpStatus}</dd>
                      </div>
                      <div>
                        <dt>Verificação</dt>
                        <dd>Conexão e autenticação</dd>
                      </div>
                    </dl>
                    <p className={styles.cardNote}>
                      Esta consulta não envia mensagens nem confirma a entrega
                      ao destinatário.
                    </p>
                  </section>
                  {mailcatcher && (
                    <section className={styles.card}>
                      <div className={styles.cardTop}>
                        <div
                          className={`${styles.serviceIcon} ${styles.mailcatcherIcon}`}
                        >
                          <svg
                            width="25"
                            height="25"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                          >
                            <path d="m4 5-2 9v6h20v-6l-2-9H4Z" />
                            <path d="M2 14h6l2 3h4l2-3h6" />
                          </svg>
                        </div>
                        <span
                          className={`${styles.badge} ${getBadgeClass(mailcatcher.connected, error)}`}
                        >
                          <span className={styles.dot} />
                          {mailcatcherStatus}
                        </span>
                      </div>
                      <h3>MailCatcher</h3>
                      <p className={styles.cardDescription}>
                        Caixa de entrada do ambiente local.
                      </p>
                      <dl className={styles.details}>
                        <div>
                          <dt>Interface HTTP</dt>
                          <dd>{mailcatcherStatus}</dd>
                        </div>
                        <div>
                          <dt>Mensagens capturadas</dt>
                          <dd>
                            {mailcatcher.captured_messages ?? "Não disponível"}
                          </dd>
                        </div>
                        <div>
                          <dt>Versão</dt>
                          <dd>
                            {mailcatcher.version ??
                              "Não informada pelo serviço"}
                          </dd>
                        </div>
                      </dl>
                      <a
                        className={styles.inboxLink}
                        href={mailcatcher.web_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir caixa de entrada <span aria-hidden="true">↗</span>
                      </a>
                    </section>
                  )}
                </div>
              </>
            )}
            <footer className={styles.footer}>
              <div>
                <span className={styles.footerClock} aria-hidden="true">
                  ◷
                </span>
                <span>
                  Última atualização:{" "}
                  <strong>
                    {data?.updated_at
                      ? new Date(data.updated_at).toLocaleString("pt-BR")
                      : "Aguardando consulta"}
                  </strong>
                </span>
              </div>
              <span>Atualização automática a cada 30 segundos.</span>
            </footer>
            <div className={styles.bottomNote}>
              Informações obtidas diretamente dos serviços. Sem envio de
              mensagens de teste.
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
