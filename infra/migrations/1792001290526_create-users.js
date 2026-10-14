export const up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    company_id: {
      type: "uuid",
      references: "companies",
    },
    name: {
      type: "text",
      notNull: true,
      check: "length(btrim(name)) > 0 AND name = btrim(name)",
    },
    email: {
      type: "varchar(254)",
      notNull: true,
      unique: true,
      check: "length(email) > 0 AND email = lower(btrim(email))",
    },
    password_hash: {
      type: "text",
      check: "length(btrim(password_hash)) > 0",
    },
    role: {
      type: "text",
      notNull: true,
      check:
        "role IN ('platform_admin', 'technician', 'company_admin', 'company_member')",
    },
    status: {
      type: "text",
      notNull: true,
      default: "invited",
      check: "status IN ('invited', 'active', 'inactive')",
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

  pgm.addConstraint("users", "users_role_company_check", {
    check:
      "(role IN ('platform_admin', 'technician') AND company_id IS NULL) OR " +
      "(role IN ('company_admin', 'company_member') AND company_id IS NOT NULL)",
  });

  pgm.addConstraint("users", "users_active_password_check", {
    check: "status <> 'active' OR password_hash IS NOT NULL",
  });

  pgm.createIndex("users", "company_id");
};
