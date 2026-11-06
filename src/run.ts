import { collectCitations, InfraiClient, Request } from "./citation_service.ts";

const input = Request.parse({ tenantId: "acme-research", accountId: "admin-001", query: "saas citation collector api", domains: [] });
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");
const result = await collectCitations(input, new InfraiClient(key));
console.log(JSON.stringify({ status: "archived", ...result }, null, 2));
