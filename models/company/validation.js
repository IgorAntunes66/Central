import isEmail from "validator/lib/isEmail.js";
import isTaxID from "validator/lib/isTaxID.js";
import { ValidationError } from "infra/errors";

const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError({ message: "Informe os dados da empresa." });
  }

  const company = {
    name: readText(data, "name", true),
    cnpj: readText(data, "cnpj", true).replace(/[./-]/g, "").toUpperCase(),
    ctr: readText(data, "ctr", true),
    email: readText(data, "email"),
    phone: readText(data, "phone"),
    address_zip_code: readText(data, "address_zip_code"),
    address_state: readText(data, "address_state"),
    address_street: readText(data, "address_street"),
    address_number: readText(data, "address_number"),
    address_complement: readText(data, "address_complement"),
    address_neighborhood: readText(data, "address_neighborhood"),
    address_city: readText(data, "address_city"),
  };

  if (
    !/^[A-Z0-9]{12}[0-9]{2}$/.test(company.cnpj) ||
    !isTaxID(company.cnpj, "pt-BR")
  ) {
    throw new ValidationError({ message: "Informe um CNPJ válido." });
  }
  if (!/^[0-9]{3}\/[0-9]{2}$/.test(company.ctr)) {
    throw new ValidationError({ message: "Informe o CTR no formato 365/23." });
  }
  if (
    company.email &&
    (Buffer.byteLength(company.email, "utf8") > 254 ||
      !isEmail(company.email, { allow_utf8_local_part: false }))
  ) {
    throw new ValidationError({
      message: "Informe um endereço de e-mail válido.",
    });
  }
  if (company.phone) {
    company.phone = company.phone.replace(/[()\s.-]/g, "");
    if (!/^\+[1-9][0-9]{1,14}$/.test(company.phone)) {
      throw new ValidationError({
        message: "Informe o telefone com + e o código do país.",
      });
    }
  }
  if (company.address_zip_code) {
    company.address_zip_code = company.address_zip_code.replace(/-/g, "");
    if (!/^[0-9]{8}$/.test(company.address_zip_code)) {
      throw new ValidationError({
        message: "Informe um CEP com oito dígitos.",
      });
    }
  }
  if (company.address_state) {
    company.address_state = company.address_state.toUpperCase();
    if (!states.includes(company.address_state)) {
      throw new ValidationError({
        message: "Informe uma UF brasileira válida.",
      });
    }
  }
  return company;
}

function readText(data, field, required = false) {
  const value = data[field] ?? "";
  if (typeof value !== "string" || value.includes("\0")) {
    throw new ValidationError({
      message: `O campo ${field} deve ser um texto válido.`,
    });
  }

  const text = value.trim();
  if (required && !text) {
    throw new ValidationError({ message: `O campo ${field} é obrigatório.` });
  }
  return text || null;
}

export default { validate };
