export const up = (pgm) => {
  pgm.createTable("companies", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name: {
      type: "text",
      notNull: true,
      check: "length(btrim(name)) > 0 AND name = btrim(name)",
    },
    cnpj: {
      type: "varchar(14)",
      notNull: true,
      unique: true,
      check: "cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'",
    },
    ctr: {
      type: "varchar(6)",
      notNull: true,
      unique: true,
      check: "ctr ~ '^[0-9]{3}/[0-9]{2}$'",
    },
    email: {
      type: "varchar(254)",
    },
    phone: {
      type: "varchar(16)",
      check: "phone ~ '^\\+[1-9][0-9]{1,14}$'",
    },
    address_zip_code: {
      type: "varchar(8)",
      check: "address_zip_code ~ '^[0-9]{8}$'",
    },
    address_street: {
      type: "text",
    },
    address_number: {
      type: "text",
    },
    address_complement: {
      type: "text",
    },
    address_neighborhood: {
      type: "text",
    },
    address_city: {
      type: "text",
    },
    address_state: {
      type: "varchar(2)",
      check: "address_state ~ '^[A-Z]{2}$'",
    },
    status: {
      type: "text",
      notNull: true,
      default: "active",
      check: "status IN ('active', 'inactive')",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
};
