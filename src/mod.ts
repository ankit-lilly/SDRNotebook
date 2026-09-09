// Stable public entrypoint for notebook consumers.
export type {
  AwsClientConfig,
  AwsClientConstructor,
  CypherBuilder,
  CypherInput,
  GremlinInput,
  NeptuneClient,
  NeptuneClientOptions,
  NeptuneQuery,
  QueryType,
  RequestSigner,
} from "./connection/types.ts";
export type {
  Edge,
  GraphData,
  GraphPath,
  GraphRendererOptions,
  RichDisplay,
  Vertex,
} from "./display/types.ts";

// Client
export { createClient } from "./connection/client.ts";
export { connectNotebook } from "./connection/notebook.ts";
export { ui } from "./display/ui.tsx";

// Gremlin
export {
  createTraversalSource,
  isTraversal,
  toGremlinScript,
} from "./query/gremlin.ts";

// Cypher
export {
  buildCypherQuery,
  inlineParams,
  isCypherBuilder,
} from "./query/cypher.ts";

// Graph Renderer
export {
  extractGraphData,
  openGraph,
  renderGraph,
  renderGraphSvg,
  saveGraph,
} from "./display/graph.ts";

// Charts
export { bar, groupedBar, pie } from "./display/charts.ts";

// Domain Helpers (SDR-specific)
export {
  edgeLabelCounts,
  labelCounts,
  sampleStudies,
  studyNeighborhood,
  studyVersions,
} from "./sdr/helpers.ts";
