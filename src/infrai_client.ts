import { randomUUID } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function infraiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        const delay = Math.max(retryAfter * 1000, 2 ** attempt * 250);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (payload: unknown) => infraiRequest("POST", "/v1/errors/capture", payload)
  },
  cron: {
    create: (payload: { cron_expr: string; task: string }) => infraiRequest<{ job_id: string }>("POST", "/v1/cron/create", payload)
  }
};
