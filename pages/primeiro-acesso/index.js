import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import invitation from "models/invitation";
import styles from "./first-access.module.css";

export async function getServerSideProps({ query, res }) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const token = (await invitation.isValid(query.token)) ? query.token : null;
  return { props: { token } };
}

// eslint-disable-next-line react/prop-types -- The server supplies a validated token or null.
export default function FirstAccessPage({ token }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (Array.from(password).length < 12) {
      setError("Sua senha precisa ter pelo menos 12 caracteres.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Sua senha excede o limite de 72 bytes. Use uma frase menor.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem. Confira a confirmação.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.name === "ValidationError"
            ? body.message
            : "Não foi possível definir sua senha. Tente novamente em instantes.",
        );
        return;
      }
      setComplete(true);
      setPassword("");
      setConfirmation("");
      // Remove the consumed token without resetting the success state.
      void router
        .replace("/primeiro-acesso", undefined, { shallow: true })
        .catch(() => {});
    } catch {
      setError(
        "Não conseguimos conectar à Central. Confira sua conexão e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Primeiro acesso | Central</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="application-name" content="Central" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <main className={styles.page}>
        <aside className={styles.story}>
          <Link href="/" className={styles.brand} aria-label="Central — início">
            <span className={styles.mark}>
              c<span>·</span>
            </span>
            <span>
              central<small>CUIDAR COMEÇA POR AQUI</small>
            </span>
          </Link>
          <div className={styles.storyContent}>
            <span className={styles.eyebrow}>UM NOVO JEITO DE ESTAR PERTO</span>
            <h1>
              Seu atendimento.
              <br />
              Nossa atenção.
            </h1>
            <p>
              Um lugar para pedir ajuda, acompanhar solicitações e encontrar
              quem resolve.
            </p>
            <div className={styles.orbit} aria-hidden="true">
              <span>c·</span>
            </div>
          </div>
          <p className={styles.storyFooter}>
            Mais clareza. Mais conexão. Mais cuidado.
          </p>
        </aside>

        <section className={styles.panel} aria-label="Primeiro acesso">
          <span className={styles.step}>BOAS-VINDAS À CENTRAL</span>
          {complete ? (
            <div className={styles.result} role="status">
              <span className={styles.successMark} aria-hidden="true">
                ✓
              </span>
              <h2>Pronto. Sua conta está ativa.</h2>
              <p>
                Sua senha foi definida com sucesso. Guarde-a com cuidado e não
                compartilhe com outras pessoas.
              </p>
              <p>Você pode fechar esta página.</p>
            </div>
          ) : !token ? (
            <div className={styles.result}>
              <span className={styles.invalidMark} aria-hidden="true">
                ↗
              </span>
              <h2>Precisamos de um novo convite.</h2>
              <p>
                Este link é inválido, expirou ou já foi utilizado. Peça um novo
                convite à pessoa responsável pelo seu cadastro.
              </p>
            </div>
          ) : (
            <>
              <h2>Vamos começar?</h2>
              <p className={styles.intro}>
                Defina sua senha para ativar a conta.
                <br />
                Este é o primeiro passo para estar mais perto.
              </p>
              <form onSubmit={handleSubmit} className={styles.form}>
                <label htmlFor="password">Sua senha</label>
                <div className={styles.passwordField}>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    aria-describedby="password-hint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                    disabled={submitting}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <p id="password-hint" className={styles.hint}>
                  Use uma frase com pelo menos 12 caracteres. Espaços são
                  permitidos.
                </p>
                <label htmlFor="confirmation">Confirme sua senha</label>
                <input
                  id="confirmation"
                  name="confirmation"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={submitting}
                />
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={submitting}
                >
                  {submitting
                    ? "Ativando sua conta…"
                    : "Definir senha e ativar conta"}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className={styles.privacy}>
                Seu convite é pessoal e pode ser usado uma única vez.
              </p>
            </>
          )}
          <footer className={styles.footer}>
            <span>central · gente que resolve</span>
            <Link href="/status">Status dos serviços ↗</Link>
          </footer>
        </section>
      </main>
    </>
  );
}
