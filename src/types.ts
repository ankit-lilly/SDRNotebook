import type { createTraversalSource } from "./gremlin.ts";

export const DISPLAY_SYMBOL = Symbol.for("Jupyter.display");

/** Query language type matching the GraphQL QueryType enum */
export type QueryType = "gremlin" | "cypher";

/** Input for the executeQuery GraphQL mutation */
export interface NeptuneQuery {
  type: QueryType;
  query: string;
}

/** GraphQL response envelope from AppSync */
export interface GraphQLResponse {
  data?: { executeQuery?: string };
  errors?: Array<{ message: string; errorType?: string }>;
}

/** Options for creating a NeptuneClient */
export interface NeptuneClientOptions {
  /** AWS CLI profile name (e.g., "dsoadev") */
  profile: string;
  /** AWS region (optional, inferred from profile if omitted) */
  region?: string;
  /** AppSync API name filter for discovery (optional) */
  apiName?: string;
  /** AppSync API ID filter for discovery (optional) */
  apiId?: string;
  /** Explicit AppSync URL (skips discovery if provided) */
  url?: string;
}

export interface CypherBuilder {
  build(): { cypher: string; params: Record<string, unknown> };
}

export type GremlinInput = string | { getBytecode(): unknown };
export type CypherInput = string | CypherBuilder;

export type AwsCredentialsProvider = () => Promise<unknown>;

export interface AwsClientConfig {
  region: string;
  credentials: AwsCredentialsProvider;
}

export interface AwsClientConstructor<T> {
  new (config: Record<string, unknown>): T;
}

export interface NeptuneClient {
  region: string;
  g(): ReturnType<typeof createTraversalSource>;
  awsConfig(): AwsClientConfig;
  aws<T>(Client: AwsClientConstructor<T>, config?: Record<string, unknown>): T;
  gremlin<T = unknown>(queryOrTraversal: GremlinInput): Promise<T>;
  cypher<T = unknown>(queryOrBuilder: CypherInput): Promise<T>;
}

/** A Neptune vertex as returned by Gremlin */
export interface Vertex {
  id: string;
  label: string;
  properties?: Record<string, unknown>;
}

/** A Neptune edge as returned by Gremlin */
export interface Edge {
  id: string;
  label: string;
  inV: string;
  outV: string;
  properties?: Record<string, unknown>;
}

/** Input format for the graph renderer */
export interface GraphData {
  vertices: Vertex[];
  edges: Edge[];
}

/** A single Neptune path result as returned by Gremlin `.path()` */
export interface GraphPath {
  objects: Array<Record<string, unknown>>;
}

/** A notebook-friendly rich display object */
export interface RichDisplay {
  [key: symbol]: () => Record<string, string | Record<string, unknown>>;
}

/** Options for the graph renderer */
export interface GraphRendererOptions {
  width?: number;
  height?: number;
  nodeColors?: Record<string, string>;
  labelProperty?: string;
  /** Max characters shown on node labels (default: 20) */
  labelMaxChars?: number;
  /** Node circle radius in px (default: 25) */
  nodeRadius?: number;
  /** Font size for node labels in px (default: 9) */
  nodeFontSize?: number;
  /** Font size for edge labels in px (default: 8) */
  edgeFontSize?: number;
  /** Distance between linked nodes in px (default: 180) */
  linkDistance?: number;
  /** Charge strength — more negative = more spread (default: -400) */
  chargeStrength?: number;
  /** Show node type (label) below the display name (default: true) */
  showNodeType?: boolean;
  /** Show edge labels (default: true) */
  showEdgeLabels?: boolean;
  /**
   * What to display as the node's primary text: "property" (default), "label", or "id".
   * - "property": shows the value of `labelProperty` (e.g., name)
   * - "label": shows the vertex label/type (e.g., StudyVersion)
   * - "id": shows the vertex id
   */
  nodeDisplayText?: "property" | "label" | "id";
  /** Layout algorithm: "force" (default) or "tree" (top-down hierarchical) */
  layout?: "force" | "tree";
  /** Vertical spacing between tree levels in px (default: 120). Only used with layout: "tree". */
  levelSpacing?: number;
  /** Horizontal spacing between sibling nodes in px (default: 80). Only used with layout: "tree". */
  siblingSpacing?: number;
}
