import { createHash, randomBytes } from "node:crypto";
import isUUID from "validator/lib/isUUID.js";
import database from "infra/database";
import { ValidationError } from "infra/errors";
import password from "models/password";

async function create(userId) {
  if (typeof userId !== "string" || !isUUID(userId)) {
    throw new ValidationError({
      message: "Informe um identificador de usuário válido.",
    });
  }

  return database.transaction(async (client) => {
    const result = await client.query({
      text: "SELECT status FROM users WHERE id = $1 FOR UPDATE;",
      values: [userId],
    });
    if (result.rows[0]?.status !== "invited") {
      throw new ValidationError({
        message: "O usuário deve estar aguardando o primeiro acesso.",
      });
    }

    const token = randomBytes(32).toString("hex");
    await client.query({
      text: "DELETE FROM user_invitations WHERE user_id = $1 AND used_at IS NULL;",
      values: [userId],
    });
    const invitation = await client.query({
      text: `INSERT INTO user_invitations (user_id, token_hash, expires_at)
        VALUES ($1, $2, current_timestamp + interval '24 hours')
        RETURNING id, user_id, expires_at, created_at;`,
      values: [userId, hashToken(token)],
    });
    return { ...invitation.rows[0], token };
  });
}

async function accept(data) {
  if (!data || !hasValidTokenFormat(data.token)) {
    throw invalidInvitation();
  }

  return database.transaction(async (client) => {
    const tokenHash = hashToken(data.token);
    const result = await client.query({
      text: `SELECT id, status FROM users
        WHERE id = (SELECT user_id FROM user_invitations WHERE token_hash = $1)
        FOR UPDATE;`,
      values: [tokenHash],
    });
    if (result.rows[0]?.status !== "invited") {
      throw invalidInvitation();
    }

    const consumed = await client.query({
      text: `UPDATE user_invitations SET used_at = current_timestamp
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > clock_timestamp()
        RETURNING user_id;`,
      values: [tokenHash],
    });
    if (!consumed.rowCount) {
      throw invalidInvitation();
    }

    const passwordHash = await password.hash(data.password);
    const activated = await client.query({
      text: `UPDATE users SET password_hash = $1, status = 'active', updated_at = current_timestamp
        WHERE id = $2
        RETURNING id, company_id, name, email, role, status, created_at, updated_at;`,
      values: [passwordHash, consumed.rows[0].user_id],
    });
    return activated.rows[0];
  });
}

async function isValid(token) {
  if (!hasValidTokenFormat(token)) return false;
  const result = await database.query({
    text: `SELECT EXISTS (
      SELECT 1 FROM user_invitations invitation
      JOIN users ON users.id = invitation.user_id
      WHERE invitation.token_hash = $1 AND invitation.used_at IS NULL
        AND invitation.expires_at > clock_timestamp() AND users.status = 'invited'
    ) AS valid;`,
    values: [hashToken(token)],
  });
  return result.rows[0].valid;
}

function hasValidTokenFormat(token) {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function invalidInvitation() {
  return new ValidationError({
    message: "O convite é inválido, expirou ou já foi utilizado.",
  });
}

export default { create, accept, isValid };
