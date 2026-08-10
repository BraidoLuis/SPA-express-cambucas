export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.NOTIFICATION_SECRET}`) return new Response("Não autorizado", { status: 401 });
  const { to, template = "appointment_confirmation", parameters = [] } = await request.json();
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: "pt_BR" }, components: [{ type: "body", parameters: parameters.map((text: string) => ({ type: "text", text })) }] },
    }),
  });
  return Response.json(await response.json(), { status: response.status });
}
