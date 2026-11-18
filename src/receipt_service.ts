import { createServer } from "node:http";
import { z } from "zod";
import { infrai } from "./infrai_client.ts";

export const checkoutRequest = z.object({
  donorId: z.string().min(1),
  donorEmail: z.string().email(),
  amountCents: z.number().int().positive(),
  campaign: z.string().min(1),
  volunteerId: z.string().min(1),
  reminderAt: z.string().datetime()
});

export function buildCampaignReport(input: z.infer<typeof checkoutRequest>) {
  return {
    campaign: input.campaign,
    receipt: { donorId: input.donorId, amountCents: input.amountCents, status: "queued" },
    volunteerReminder: { volunteerId: input.volunteerId, at: input.reminderAt },
    report: { donations: 1, amountCents: input.amountCents }
  };
}

async function captureReceiptFailure(error: unknown, input: unknown) {
  await infrai.errors.capture({
    title: "receipt workflow rejected",
    message: error instanceof Error ? error.message : "request validation failed",
    level: "error",
    exception: { name: "ReceiptWorkflowError", message: String(error) },
    context: { input }
  });
}

export function startReceiptService(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/receipts") {
      response.writeHead(404).end();
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch (error) {
      await captureReceiptFailure(error, raw);
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid receipt request" }));
      return;
    }
    const parsed = checkoutRequest.safeParse(body);
    if (!parsed.success) {
      await captureReceiptFailure(parsed.error, raw);
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid receipt request" }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(buildCampaignReport(parsed.data)));
  });
  server.listen(port);
  return server;
}

if (process.argv[1]?.endsWith("receipt_service.ts")) {
  startReceiptService();
  console.log("receipt service listening on http://localhost:3000");
}
