import { assertEquals } from "@std/assert";
import { buildCypherQuery, inlineParams } from "./cypher.ts";
import Cypher from "@neo4j/cypher-builder";

Deno.test("inlineParams replaces string params with escaped values", () => {
  const result = inlineParams("WHERE s.name = $param0", { param0: "O'Brien" });
  assertEquals(result, "WHERE s.name = 'O''Brien'");
});

Deno.test("inlineParams replaces number params", () => {
  const result = inlineParams("LIMIT $param0", { param0: 10 });
  assertEquals(result, "LIMIT 10");
});

Deno.test("inlineParams replaces boolean params", () => {
  const result = inlineParams("WHERE s.active = $param0", { param0: true });
  assertEquals(result, "WHERE s.active = true");
});

Deno.test("inlineParams handles multiple params", () => {
  const result = inlineParams(
    "WHERE s.name = $param0 AND s.status = $param1",
    { param0: "Study1", param1: "active" },
  );
  assertEquals(result, "WHERE s.name = 'Study1' AND s.status = 'active'");
});

Deno.test("buildCypherQuery produces correct Cypher from builder", () => {
  const s = new Cypher.NamedNode("s");
  const pattern = new Cypher.Pattern(s, { labels: ["Study"] });
  const query = new Cypher.Match(pattern).return(s).limit(5);

  const result = buildCypherQuery(query);
  assertEquals(result.includes("MATCH (s:Study)"), true);
  assertEquals(result.includes("RETURN s"), true);
  assertEquals(result.includes("LIMIT 5"), true);
});

Deno.test("buildCypherQuery inlines Param values", () => {
  const s = new Cypher.NamedNode("s");
  const pattern = new Cypher.Pattern(s, { labels: ["Study"] });
  const query = new Cypher.Match(pattern)
    .where(Cypher.eq(s.property("name"), new Cypher.Param("TestStudy")))
    .return(s);

  const result = buildCypherQuery(query);
  assertEquals(result.includes("$param"), false);
  assertEquals(result.includes("'TestStudy'"), true);
});

Deno.test("buildCypherQuery with relationship", () => {
  const s = new Cypher.NamedNode("s");
  const v = new Cypher.NamedNode("v");
  const r = new Cypher.NamedRelationship("r");

  const pattern = new Cypher.Pattern(s, { labels: ["Study"] })
    .related(r, { type: "hasVersion" })
    .to(v, { labels: ["StudyVersion"] });

  const query = new Cypher.Match(pattern).return(s, v);
  const result = buildCypherQuery(query);

  assertEquals(result.includes("Study"), true);
  assertEquals(result.includes("hasVersion"), true);
  assertEquals(result.includes("StudyVersion"), true);
});

Deno.test("isCypherBuilder detects builder vs string", async () => {
  const { isCypherBuilder } = await import("./cypher.ts");
  const s = new Cypher.NamedNode("s");
  const query = new Cypher.Match(new Cypher.Pattern(s)).return(s);

  assertEquals(isCypherBuilder(query), true);
  assertEquals(isCypherBuilder("MATCH (s) RETURN s"), false);
});
