import isEmail from "validator/lib/isEmail.js";
import isUUID from "validator/lib/isUUID.js";
import { ValidationError } from "infra/errors";

const internalRoles = ["platform_admin", "technician"];
const companyRoles = ["company_admin", "company_member"];

function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError({ message: "Informe os dados do usuário." });
  }

  const user = {
    name: readText(data, "name"),
    email: readText(data, "email").toLowerCase(),
    role: readText(data, "role"),
    company_id: data.company_id ?? null,
  };

  if (
    Buffer.byteLength(user.email, "utf8") > 254 ||
    !isEmail(user.email, { allow_utf8_local_part: false })
  ) {
    throw new ValidationError({
      message: "Informe um endereço de e-mail válido.",
    });
  }

  if (![...internalRoles, ...companyRoles].includes(user.role)) {
    throw new ValidationError({
      message: "Informe um perfil de usuário válido.",
    });
  }

  if (internalRoles.includes(user.role)) {
    if (user.company_id !== null) {
      throw new ValidationError({
        message:
          "Usuários internos não devem estar vinculados a uma empresa cliente.",
      });
    }
  } else {
    if (typeof user.company_id !== "string" || !isUUID(user.company_id)) {
      throw new ValidationError({
        message: "Informe o identificador válido da empresa do usuário.",
      });
    }
  }

  return user;
}

function readText(data, field) {
  const value = data[field];
  if (typeof value !== "string" || value.includes("\0")) {
    throw new ValidationError({
      message: `O campo ${field} deve ser um texto válido.`,
    });
  }
  const text = value.trim();
  if (!text) {
    throw new ValidationError({ message: `O campo ${field} é obrigatório.` });
  }
  return text;
}

export default { validate };
