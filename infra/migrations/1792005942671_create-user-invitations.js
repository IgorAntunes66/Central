export const up = (pgm) => {
  pgm.createTable("user_invitations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    token_hash: {
      type: "varchar(64)",
      notNull: true,
      unique: true,
      check: "token_hash ~ '^[0-9a-f]{64}$'",
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
      check: "expires_at > created_at",
    },
    used_at: {
      type: "timestamptz",
      check: "used_at >= created_at",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("user_invitations", "user_id");
};
