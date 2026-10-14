import database from "infra/database";
import email from "infra/email";

async function getStatus() {
  const updatedAt = new Date().toISOString();

  const versionResult = await database.query("SHOW server_version;");
  const versionValue = versionResult.rows[0].server_version;
  const formatedVersionValue = versionValue.slice(0, 2);

  const maxConnectionResult = await database.query("SHOW max_connections;");
  const maxConnectionValue = maxConnectionResult.rows[0].max_connections;

  const databaseName = process.env.POSTGRES_DB;
  const openedConnectionsResult = await database.query({
    text: "SELECT count(*)::int FROM pg_stat_activity WHERE datname = $1;",
    values: [databaseName],
  });
  const openedConnectionsValue = openedConnectionsResult.rows[0].count;
  const emailStatus = await getEmailStatus();

  return {
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: formatedVersionValue,
        max_connections: parseInt(maxConnectionValue),
        opened_connections: openedConnectionsValue,
      },
      email: emailStatus,
    },
  };
}

async function getEmailStatus() {
  try {
    await email.verifyConnection();
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

export default { getStatus };
