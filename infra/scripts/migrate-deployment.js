import migrations from "../../models/migrations.js";

// Use the deployment's configured database; local migrations remain explicit.
if (process.env.VERCEL === "1") {
  process.env.NODE_ENV = "production";
  await migrations.applyPendingMigrations();
}
