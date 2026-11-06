import test from "node:test";
import assert from "node:assert/strict";
import { dedupeCitations } from "./citation_service.ts";

test("keeps the first record for each source URL", () => {
  const result = dedupeCitations([{ url: "https://docs.example/a", title: "first" }, { url: "https://docs.example/a/", title: "repeat" }, { url: "https://docs.example/b", title: "second" }]);
  assert.deepEqual(result.map((item) => item.title), ["first", "second"]);
});
