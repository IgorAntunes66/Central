import database from "infra/database";
import email from "infra/email";
import invitation from "models/invitation";

async function send(userId) {
  const url = getApplicationUrl();
  const created = await invitation.create(userId);
  const result = await database.query({
    text: "SELECT name, email FROM users WHERE id = $1;",
    values: [userId],
  });
  const user = result.rows[0];
  if (!user) {
    throw new Error("O usuário do convite não está mais disponível.");
  }

  url.pathname = "/primeiro-acesso";
  url.searchParams.set("token", created.token);
  await email.send({
    to: user.email,
    subject: "Defina sua senha na Central",
    text: `Olá, ${user.name}!\n\nSua conta na Central foi criada. Acesse o link abaixo para definir sua senha:\n\n${url.href}\n\nEste convite é válido por 24 horas e pode ser utilizado apenas uma vez.\n\nSe você não esperava este convite, entre em contato com nossa equipe.`,
  });

  return {
    id: created.id,
    user_id: created.user_id,
    expires_at: created.expires_at,
  };
}

function getApplicationUrl() {
  const previewHost =
    process.env.VERCEL_ENV === "preview"
      ? process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
      : null;
  const origin =
    process.env.APP_BASE_URL ||
    (previewHost ? `https://${previewHost}` : undefined);
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("Configure APP_BASE_URL com a origem da aplicação.");
  }
  const localHttp =
    ["development", "test"].includes(process.env.NODE_ENV) &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_BASE_URL deve ser uma origem HTTPS, ou HTTP local em desenvolvimento e testes.",
    );
  }
  return url;
}

export default { send };
