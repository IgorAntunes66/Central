import bcrypt from "bcrypt";
import { ValidationError } from "infra/errors";

const MIN_LENGTH = 12;
const MAX_BYTES = 72;

async function hash(value) {
  if (typeof value !== "string" || Array.from(value).length < MIN_LENGTH) {
    throw new ValidationError({
      message: "A senha deve conter pelo menos 12 caracteres.",
    });
  }
  if (Buffer.byteLength(value, "utf8") > MAX_BYTES) {
    throw new ValidationError({
      message: "A senha deve conter no máximo 72 bytes.",
    });
  }
  const cost = ["development", "test"].includes(process.env.NODE_ENV) ? 4 : 12;
  return bcrypt.hash(value, cost);
}

async function compare(value, hash) {
  if (
    typeof value !== "string" ||
    !value ||
    Buffer.byteLength(value, "utf8") > MAX_BYTES ||
    typeof hash !== "string" ||
    !hash
  ) {
    return false;
  }
  return bcrypt.compare(value, hash);
}

export default { hash, compare };
