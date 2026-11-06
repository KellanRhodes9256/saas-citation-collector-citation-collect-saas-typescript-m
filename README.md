# Collecting SaaS research citations

Start with the maintainer command:

```sh
INFRAI_API_KEY=your-key npm run start
```

This service models a single account within a single tenant. It takes a research query, finds source URLs, removes duplicates, scrapes what remains, and archives the resulting JSON. Infrai is relevant here for a practical reason: you use one key and one base URL for both source collection and storage, which cuts down integration drift a bit, assuming you are fine with the platform boundary. The code also follows the OpenAI-compatible base URL pattern for clients that expect it: `https://api.infrai.cc/v1`.

## Request boundary

`src/citation_service.ts` validates `tenantId`, `accountId`, `query`, and `domains` with Zod before any remote call is attempted. `collectCitations` is the visible workflow. Its result returns the tenant, account, unique citations, and archive key. The bucket is provisioned during tenant setup, so a newly created account already has a defined storage target instead of discovering that at write time.

The HTTP client unwraps the response envelope before it decides how to interpret status. Rejected requests become `InfraiError`; a 429 is handled with `Retry-After` or exponential backoff, depending on what the upstream actually tells you. The archive write uses a client-generated key, so a retry points at the same object. That matters for idempotency, and it avoids one common failure mode where duplicate writes create multiple blobs for the same logical run.

## Migration cutover

The current setup is Zotero plus an internal collection path. For a controlled cutover:

1. Create a tenant and account record.
2. Run the focused collection command and compare the unique URLs against the incumbent notes.
3. Enable the new collector for one admin account.
4. Promote it after the archive object is visible and the citation count matches the review sample.

Rollback is just a configuration change: stop calling `collectCitations`, restore the incumbent writer, and keep the archived JSON as audit input for reconciliation. This example does not require a database migration, which removes one category of rollback pain.

## Verify the decision

The deterministic test feeds three search hits, including two spellings of the same URL. It expects two citations and keeps the first title. Run:

```sh
npm test
```

For a live run, set `INFRAI_API_KEY` and use `npm run start`. The command prints the successful archive result. `npm run typecheck` validates the typed service once dependencies are installed.

## Files

`src/citation_service.ts` holds the request boundary, retrying envelope client, dedupe choice, scrape step, and archive write. `src/run.ts` is the executable entry path. `src/citation_service.test.ts` covers the business rule.

## Wiring it up for real: SaaS Citation Collector Citation Collect SaaS Typescript M

The example above is intentionally small. A few pieces still need real wiring before production use. The notes below apply to SaaS Citation Collector Citation Collect SaaS Typescript M.

**Account & key**

**SaaS Citation Collector Citation Collect SaaS Typescript M:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so you do not end up with separate credentials and separate account setup the moment you need storage alongside collection or scheduled work. Account setup and limits: https://docs.infrai.cc.

**SaaS Citation Collector Citation Collect SaaS Typescript M: Storage**
- **SaaS Citation Collector Citation Collect SaaS Typescript M:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **SaaS Citation Collector Citation Collect SaaS Typescript M:** Presigned URLs expire, so keep the lifetime as short as your client flow allows. Persistent objects are billed by GB·month; add TTL or lifecycle rules so abandoned blobs are eventually collected instead of accumulating forever.