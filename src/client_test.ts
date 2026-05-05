import { assertEquals, assertRejects } from "@std/assert";
import {
  parseAppSyncResponse,
  buildExecuteQueryPayload,
} from "./client.ts";

Deno.test("buildExecuteQueryPayload builds correct GraphQL mutation", () => {
  const payload = buildExecuteQueryPayload("gremlin", "g.V().count()");
  const parsed = JSON.parse(payload);
  assertEquals(parsed.query, "mutation ($input: NeptuneQuery!) { executeQuery(input: $input) }");
  assertEquals(parsed.variables.input.type, "gremlin");
  assertEquals(parsed.variables.input.query, "g.V().count()");
});

Deno.test("buildExecuteQueryPayload for cypher", () => {
  const payload = buildExecuteQueryPayload("cypher", "MATCH (s:Study) RETURN s");
  const parsed = JSON.parse(payload);
  assertEquals(parsed.variables.input.type, "cypher");
  assertEquals(parsed.variables.input.query, "MATCH (s:Study) RETURN s");
});

Deno.test("parseAppSyncResponse unwraps nested JSON", () => {
  const response = {
    data: { executeQuery: JSON.stringify({ data: [{ id: "1", label: "Study" }] }) },
  };
  const result = parseAppSyncResponse(response);
  assertEquals(result, [{ id: "1", label: "Study" }]);
});

Deno.test("parseAppSyncResponse unwraps without inner data key", () => {
  const response = {
    data: { executeQuery: JSON.stringify([{ count: 42 }]) },
  };
  const result = parseAppSyncResponse(response);
  assertEquals(result, [{ count: 42 }]);
});

Deno.test("parseAppSyncResponse throws on GraphQL errors with no data", () => {
  const response = { errors: [{ message: "Unauthorized" }] };
  let threw = false;
  try { parseAppSyncResponse(response); } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes("Unauthorized"), true);
  }
  assertEquals(threw, true);
});

Deno.test("parseAppSyncResponse returns data and logs warnings for partial errors", () => {
  const response = {
    data: { executeQuery: JSON.stringify({ data: [{ id: "1" }] }) },
    errors: [{ message: "partial warning" }],
  };
  const result = parseAppSyncResponse(response);
  assertEquals(result, [{ id: "1" }]);
});

Deno.test("parseAppSyncResponse handles non-stringified executeQuery", () => {
  const response = { data: { executeQuery: "42" } };
  const result = parseAppSyncResponse(response);
  assertEquals(result, 42);
});
