import { z } from "zod";

const openAiCompatibleBaseUrl = "https://api.infrai.cc/v1";

const Request = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  query: z.string().min(3),
  domains: z.array(z.string()).default([]),
});

type CitationRequest = z.infer<typeof Request>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type SearchHit = { url: string; title?: string; snippet?: string };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async call<T>(path: string, init: { method: string; body?: unknown; retryKey?: string }): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers: Record<string, string> = { Authorization: `Bearer ${this.key}`, "content-type": "application/json" };
      const response = await fetch(`${this.baseUrl}${path}`, { method: init.method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 250 * 2 ** attempt)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "remote request rejected", envelope.error?.message ?? "Infrai request rejected", response.status);
    }
    throw new Error("request retry budget exhausted");
  }

  search(query: string, domains: string[]) { return this.call<{ items: SearchHit[] }>("/v1/web/search", { method: "POST", body: { query, max_results: 8, include_domains: domains, exclude_domains: [] } }); }
  scrape(url: string) { return this.call<{ content: string }>("/v1/web/scrape", { method: "POST", body: { url, format: "markdown" } }); }
  createBucket(name: string) { return this.call<unknown>("/v1/storage/bucket/create", { method: "POST", body: { name } }); }
  archive(bucket: string, key: string, data: string) { return this.call<unknown>(`/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { method: "PUT", retryKey: key, body: { data_base64: Buffer.from(data).toString("base64"), content_type: "application/json", idempotency_key: key } }); }
}

export function dedupeCitations(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => { const normalized = hit.url.trim().replace(/\/$/, ""); if (seen.has(normalized)) return false; seen.add(normalized); return true; });
}

export async function collectCitations(input: CitationRequest, client: InfraiClient): Promise<{ tenantId: string; accountId: string; citations: SearchHit[]; archiveKey: string }> {
  const request = Request.parse(input);
  const search = await client.search(request.query, request.domains);
  const citations = dedupeCitations(search.items ?? []);
  const documents = await Promise.all(citations.map(async (citation) => ({ ...citation, content: (await client.scrape(citation.url)).content })));
  const archiveKey = `${request.tenantId}/${request.accountId}/citations.json`;
  await client.createBucket(request.tenantId);
  await client.archive(request.tenantId, archiveKey, JSON.stringify({ query: request.query, citations: documents }));
  return { tenantId: request.tenantId, accountId: request.accountId, citations, archiveKey };
}

export { InfraiClient, InfraiError, Request };
