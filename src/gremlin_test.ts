import { assertEquals } from "@std/assert";
import { createTraversalSource, toGremlinScript } from "./gremlin.ts";

Deno.test("createTraversalSource returns a GraphTraversalSource", () => {
  const g = createTraversalSource();
  assertEquals(typeof g.V, "function");
});

Deno.test("toGremlinScript serializes simple traversal", () => {
  const g = createTraversalSource();
  const traversal = g.V().hasLabel("Study").limit(5);
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().hasLabel('Study').limit(5)");
});

Deno.test("toGremlinScript serializes traversal with out/values", () => {
  const g = createTraversalSource();
  const traversal = g.V().hasLabel("Study").out("hasVersion").values("name");
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().hasLabel('Study').out('hasVersion').values('name')");
});

Deno.test("toGremlinScript serializes predicates", async () => {
  const g = createTraversalSource();
  const { P } = await import("gremlin").then((m) => m.process);
  const traversal = g.V().hasLabel("Study").has("status", P.eq("active"));
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().hasLabel('Study').has('status', eq('active'))");
});

Deno.test("toGremlinScript serializes path traversal", () => {
  const g = createTraversalSource();
  const traversal = g.V().hasLabel("Study").outE().inV().path();
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().hasLabel('Study').outE().inV().path()");
});

Deno.test("toGremlinScript serializes as/select", () => {
  const g = createTraversalSource();
  const traversal = g.V().hasLabel("Study").as("s").out("hasVersion").as("v").select("s", "v");
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().hasLabel('Study').as('s').out('hasVersion').as('v').select('s', 'v')");
});

Deno.test("toGremlinScript serializes count", () => {
  const g = createTraversalSource();
  const traversal = g.V().count();
  const script = toGremlinScript(traversal);
  assertEquals(script, "g.V().count()");
});

Deno.test("isTraversal detects traversal vs string", async () => {
  const g = createTraversalSource();
  const { isTraversal } = await import("./gremlin.ts");
  assertEquals(isTraversal(g.V()), true);
  assertEquals(isTraversal("g.V()"), false);
});
