import { runner as migrationRunner } from "node-pg-migrate";
import { join } from "node:path";
import database from "../infra/database.js";

async function listPendingMigrations() {
  return runMigrations({ dryRun: true });
}

async function applyPendingMigrations() {
  return runMigrations({ dryRun: false });
}

async function runMigrations({ dryRun }) {
  const dbClient = await database.getNewClient();
  try {
    return await migrationRunner({
      dbClient,
      dryRun,
      dir: join(process.cwd(), "infra", "migrations"),
      direction: "up",
      verbose: true,
      migrationsTable: "pgmigrations",
    });
  } finally {
    await dbClient.end();
  }
}

export default { listPendingMigrations, applyPendingMigrations };
