import database from "infra/database";
import { ConflictError } from "infra/errors";
import companyValidation from "models/company/validation";

async function create(data) {
  const company = companyValidation.validate(data);
  try {
    const result = await database.query({
      text: `INSERT INTO companies (
        name, cnpj, ctr, email, phone, address_zip_code, address_street,
        address_number, address_complement, address_neighborhood,
        address_city, address_state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;`,
      values: [
        company.name,
        company.cnpj,
        company.ctr,
        company.email,
        company.phone,
        company.address_zip_code,
        company.address_street,
        company.address_number,
        company.address_complement,
        company.address_neighborhood,
        company.address_city,
        company.address_state,
      ],
    });
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505" && error.constraint === "companies_cnpj_key") {
      throw new ConflictError({
        message: "Já existe uma empresa com este CNPJ.",
        cause: error,
      });
    }
    if (error.code === "23505" && error.constraint === "companies_ctr_key") {
      throw new ConflictError({
        message: "Já existe uma empresa com este CTR.",
        cause: error,
      });
    }
    throw error;
  }
}

export default { create };
