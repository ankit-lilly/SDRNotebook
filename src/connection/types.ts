import type { createTraversalSource } from "../query/gremlin.ts";

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
