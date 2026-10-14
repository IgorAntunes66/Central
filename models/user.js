import database from "infra/database";
import { ConflictError, ValidationError } from "infra/errors";
import userValidation from "models/user/validation";

async function create(data) {
  const user = userValidation.validate(data);
  try {
    const result = await database.query({
      text: `INSERT INTO users (name, email, role, company_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, company_id, name, email, role, status, created_at, updated_at;`,
      values: [user.name, user.email, user.role, user.company_id],
    });
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505" && error.constraint === "users_email_key") {
      throw new ConflictError({
        message: "Já existe um usuário com este e-mail.",
        cause: error,
      });
    }
    if (
      error.code === "23503" &&
      error.constraint === "users_company_id_fkey"
    ) {
      throw new ValidationError({
        message: "A empresa informada não está cadastrada.",
        cause: error,
      });
    }
    throw error;
  }
}

export default { create };
