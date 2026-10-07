export function authorizeCron(request: Request): Response | null {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret || configuredSecret === "undefined") {
    return Response.json(
      { error: "CRON_SECRET não está configurado." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const receivedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!receivedSecret || receivedSecret === "undefined" || receivedSecret !== configuredSecret) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

export function redactCronSecret(message: string): string {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? message.replaceAll(secret, "[segredo omitido]") : message;
}
