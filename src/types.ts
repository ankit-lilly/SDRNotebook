import type { createTraversalSource } from "./gremlin.ts";

export const DISPLAY_SYMBOL = Symbol.for("Jupyter.display");

export type QueryType = "gremlin" | "cypher";

export interface NeptuneQuery {
  type: QueryType;
  query: string;
}

export interface RequestSigner {
  signRequest(body: string): Promise<Record<string, string>>;
}

export interface NeptuneClientOptions {
  profile: string;
  region?: string;
  /** Explicit REST endpoint URL (skips profile-based resolution if provided) */
  url?: string;
  /** Response serializer, sent as Accept header (e.g. "application/vnd.gremlin-v2.0+json") */
  serializer?: string;
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

export interface Vertex {
  id: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface Edge {
  id: string;
  label: string;
  inV: string;
  outV: string;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  vertices: Vertex[];
  edges: Edge[];
}

export interface GraphPath {
  objects: Array<Record<string, unknown>>;
}

export interface RichDisplay {
  [key: symbol]: () => Record<string, string | Record<string, unknown>>;
}

export interface GraphRendererOptions {
  width?: number;
  height?: number;
  nodeColors?: Record<string, string>;
  labelProperty?: string;
  labelMaxChars?: number;
  nodeRadius?: number;
  nodeFontSize?: number;
  edgeFontSize?: number;
  linkDistance?: number;
  chargeStrength?: number;
  showNodeType?: boolean;
  showEdgeLabels?: boolean;
  nodeDisplayText?: "property" | "label" | "id";
  layout?: "force" | "tree";
  levelSpacing?: number;
  siblingSpacing?: number;
}
