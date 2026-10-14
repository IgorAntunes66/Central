import retry from "async-retry";
import database from "infra/database";
import email from "infra/email";

async function waitForAllServices() {
  await Promise.all([waitForWebServer(), waitForMailServer()]);

  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch("http://localhost:3000/api/v1/status");
      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

async function waitForMailServer() {
  return retry(
    async () => {
      await email.verifyConnection();
      await getEmailMessages();
    },
    { retries: 20, minTimeout: 100, maxTimeout: 1000 },
  );
}

async function getEmailMessages() {
  const response = await fetch(`${process.env.EMAIL_HTTP_URL}/messages`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`MailCatcher returned status ${response.status}.`);
  }
  return response.json();
}

async function deleteAllEmails() {
  const response = await fetch(`${process.env.EMAIL_HTTP_URL}/messages`, {
    method: "DELETE",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`MailCatcher returned status ${response.status}.`);
  }
}

async function getLastEmail() {
  return retry(
    async () => {
      const messages = await getEmailMessages();
      const message = messages.at(-1);
      if (!message) {
        throw new Error("No email has arrived yet.");
      }

      const text = await getEmailContent(message.id, "plain");
      const html = await getEmailContent(message.id, "html");
      return { ...message, text, html };
    },
    { retries: 10, minTimeout: 100, maxTimeout: 500 },
  );
}

async function getEmailContent(id, format) {
  const response = await fetch(
    `${process.env.EMAIL_HTTP_URL}/messages/${id}.${format}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`MailCatcher returned status ${response.status}.`);
  }
  return response.text();
}

async function clearDatabase() {
  await database.query("drop schema public cascade; create schema public");
}

async function runPendingMigrations() {
  const response = await fetch("http://localhost:3000/api/v1/migrations", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Migrations returned status ${response.status}.`);
  }
  return response.json();
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  waitForMailServer,
  deleteAllEmails,
  getLastEmail,
};

export default orchestrator;
