import { assertEquals, assertRejects } from "@std/assert";
import { executeQuery } from "./transport.ts";

const url = "https://example.com/dev/api/v1/internal/neptune/query";

Deno.test("REST transport signs and sends each query language and unwraps data", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const type of ["gremlin", "cypher"] as const) {
      const query = type === "gremlin"
        ? "g.V().count()"
        : "MATCH (s:Study) RETURN s";
      const body = JSON.stringify({ type, query });
      globalThis.fetch = (input, init) => {
        assertEquals(input, url);
        assertEquals(init?.method, "POST");
        assertEquals(init?.body, body);
        const headers = new Headers(init?.headers);
        assertEquals(headers.get("authorization"), "signed-request");
        assertEquals(headers.get("accept"), "application/json");
        return Promise.resolve(Response.json({ data: [{ count: 42 }] }));
      };
      const signer = {
        signRequest: (signedBody: string) => {
          assertEquals(signedBody, body);
          return Promise.resolve({ authorization: "signed-request" });
        },
      };
      assertEquals(
        await executeQuery(url, signer, type, query, "application/json"),
        [{ count: 42 }],
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("REST transport preserves unwrapped responses and reports HTTP failures", async () => {
  const originalFetch = globalThis.fetch;
  const signer = { signRequest: () => Promise.resolve({}) };
  try {
    globalThis.fetch = () => Promise.resolve(Response.json([1, 2]));
    assertEquals(await executeQuery(url, signer, "gremlin", "g.V().count()"), [
      1,
      2,
    ]);
    globalThis.fetch = () =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }));
    await assertRejects(
      () => executeQuery(url, signer, "gremlin", "g.V().count()"),
      Error,
      "HTTP 401: Unauthorized",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
