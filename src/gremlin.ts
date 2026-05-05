import { process as gp } from "gremlin";

const { GraphTraversalSource, TraversalStrategies, Bytecode, Translator } = gp;

/**
 * Creates a GraphTraversalSource with empty strategies (no remote connection).
 * Use for building traversals with full LSP autocomplete.
 */
export function createTraversalSource(): InstanceType<typeof GraphTraversalSource> {
  const strategies = new TraversalStrategies();
  return new GraphTraversalSource(null, strategies, new Bytecode());
}

/** Translator instance for converting bytecode to Gremlin script */
const translator = new Translator("g");

/**
 * Converts a fluent GraphTraversal to a Gremlin script string.
 * Uses gremlin.process.Translator to serialize bytecode.
 */
export function toGremlinScript(traversal: { getBytecode(): unknown }): string {
  const bytecode = traversal.getBytecode();
  return translator.translate(bytecode);
}

/**
 * Type guard: checks if a value is a Gremlin traversal (has getBytecode method)
 * vs a raw string.
 */
export function isTraversal(value: unknown): value is { getBytecode(): unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "getBytecode" in value &&
    typeof (value as Record<string, unknown>).getBytecode === "function"
  );
}
