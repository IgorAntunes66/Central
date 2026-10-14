async function getStatus() {
  const status = {
    connected: false,
    web_url: process.env.EMAIL_HTTP_URL,
    captured_messages: null,
    version: null,
  };

  try {
    const response = await fetch(`${status.web_url}/messages`, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) return status;

    const messages = await response.json();
    if (!Array.isArray(messages)) return status;

    return { ...status, connected: true, captured_messages: messages.length };
  } catch {
    return status;
  }
}

export default { getStatus };
