import type { NeptuneClient } from "../connection/types.ts";

export function sampleStudies(
  session: NeptuneClient,
  options: { minVersions?: number; limit?: number } = {},
): Promise<Array<{ alias: string; versionCount: number }>> {
  const minVersions = options.minVersions ?? 1;
  const limit = options.limit ?? 5;
  return session.gremlin<Array<{ alias: string; versionCount: number }>>(
    `g.V().hasLabel("Study")
      .where(out("has_version").count().is(gte(${minVersions})))
      .sample(${limit})
      .project("alias", "versionCount")
      .by("name")
      .by(out("has_version").count())`,
  );
}

export function studyVersions(
  session: NeptuneClient,
  alias: string,
): Promise<Array<Record<string, unknown>>> {
  return session.gremlin<Array<Record<string, unknown>>>(
    `g.V().has("name", ${JSON.stringify(alias)}).hasLabel("Study")
      .out("has_version").elementMap()`,
  );
}

export function studyNeighborhood(
  session: NeptuneClient,
  alias: string,
  options: { hops?: number; limit?: number } = {},
): Promise<unknown> {
  const hops = options.hops ?? 2;
  const limit = options.limit ?? 25;
  return session.gremlin(
    `g.V().has("name", ${JSON.stringify(alias)}).hasLabel("Study")
      .repeat(outE().inV().simplePath()).times(${hops})
      .path().limit(${limit})`,
  );
}

export function labelCounts(
  session: NeptuneClient,
): Promise<Array<Record<string, number>>> {
  return session.gremlin<Array<Record<string, number>>>(
    `g.V().groupCount().by(label)`,
  );
}

export function edgeLabelCounts(
  session: NeptuneClient,
): Promise<Array<Record<string, number>>> {
  return session.gremlin<Array<Record<string, number>>>(
    `g.E().groupCount().by(label)`,
  );
}
