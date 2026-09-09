import type { QueryType, RequestSigner } from "./types.ts";

const TIMEOUT_MS = 30_000;

function normalizeResponse(raw: unknown): unknown {
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    return (raw as Record<string, unknown>).data;
  }
  return raw;
}

export async function executeQuery(
  url: string,
  signer: RequestSigner,
  type: QueryType,
  query: string,
  serializer?: string,
): Promise<unknown> {
  const body = JSON.stringify({ type, query });
  const headers = await signer.signRequest(body);
  if (serializer) headers["accept"] = serializer;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return normalizeResponse(await response.json());
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
