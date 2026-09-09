/**
 * Inline params into a Cypher query string for Neptune.
 * Neptune's executeQuery takes a raw string — no parameterized queries.
 * String values are escaped (single quotes doubled) to prevent injection.
 */
export function inlineParams(
  cypher: string,
  params: Record<string, unknown>,
): string {
  let result = cypher;
  for (const [key, value] of Object.entries(params)) {
    let replacement: string;
    if (typeof value === "string") {
      const escaped = value.replace(/'/g, "''");
      replacement = `'${escaped}'`;
    } else if (typeof value === "boolean") {
      replacement = String(value);
    } else if (typeof value === "number") {
      replacement = String(value);
    } else if (value === null) {
      replacement = "null";
    } else {
      replacement = String(value);
    }
    result = result.replaceAll(`$${key}`, replacement);
  }
  return result;
}

/**
 * Build a Cypher query string from a @neo4j/cypher-builder clause.
 * Calls .build() and inlines all params for Neptune compatibility.
 */
export function buildCypherQuery(
  clause: { build(): { cypher: string; params: Record<string, unknown> } },
): string {
  const { cypher, params } = clause.build();
  return inlineParams(cypher, params);
}

/**
 * Type guard: checks if a value is a Cypher builder clause (has .build() method)
 * vs a raw string.
 */
export function isCypherBuilder(
  value: unknown,
): value is { build(): { cypher: string; params: Record<string, unknown> } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "build" in value &&
    typeof (value as Record<string, unknown>).build === "function"
  );
}
