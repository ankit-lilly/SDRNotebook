import type {
  AwsClientConfig,
  AwsClientConstructor,
  CypherBuilder,
  GraphQLResponse,
  GremlinInput,
  NeptuneClient,
  NeptuneClientOptions,
  QueryType,
} from "./types.ts";
import { AppSyncSigner, extractRegionFromUrl } from "./signer.ts";
import { createCredentialProvider } from "./auth.ts";
import { createTraversalSource, isTraversal, toGremlinScript } from "./gremlin.ts";
import { buildCypherQuery } from "./cypher.ts";
import { AppSyncClient, ListGraphqlApisCommand } from "@aws-sdk/client-appsync";
import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";

const TIMEOUT_MS = 30_000;

export async function resolveRegion(profile: string, explicitRegion?: string): Promise<string> {
  if (explicitRegion) return explicitRegion;
  try {
    const { configFile } = await loadSharedConfigFiles();
    const profileConfig = configFile[profile];
    if (profileConfig?.region) return profileConfig.region;
    const defaultConfig = configFile["default"];
    if (defaultConfig?.region) return defaultConfig.region;
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error(
    `AWS region could not be determined for profile "${profile}". ` +
      `Set region explicitly: createClient({ profile: "${profile}", region: "us-east-1" })`,
  );
}

export function buildExecuteQueryPayload(type: QueryType, query: string): string {
  return JSON.stringify({
    query: "mutation ($input: NeptuneQuery!) { executeQuery(input: $input) }",
    variables: { input: { type, query } },
  });
}

export function parseAppSyncResponse(response: GraphQLResponse): unknown {
  if (response.errors?.length && !response.data) {
    const messages = response.errors.map((error) => error.message).join("; ");
    throw new Error(`GraphQL error: ${messages}`);
  }

  if (response.errors?.length && response.data) {
    console.warn(
      `[Neptune] GraphQL warnings: ${response.errors.map((error) => error.message).join("; ")}`,
    );
  }

  const executeQueryResult = response.data?.executeQuery;
  if (executeQueryResult === undefined || executeQueryResult === null) {
    throw new Error("Unexpected response: no data.executeQuery field");
  }

  const parsed = JSON.parse(executeQueryResult);
  if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
    return parsed.data;
  }

  return parsed;
}

async function discoverAppSyncEndpoint(
  options: NeptuneClientOptions,
  credentials: AwsClientConfig["credentials"],
): Promise<{ url: string; region: string }> {
  const region = await resolveRegion(options.profile, options.region);
  const client = new AppSyncClient({ credentials: credentials as never, region });
  const { graphqlApis } = await client.send(new ListGraphqlApisCommand({}));
  if (!graphqlApis?.length) {
    throw new Error("No AppSync APIs found in this account/region.");
  }

  let apis = graphqlApis;
  if (options.apiName) apis = apis.filter((api) => api.name === options.apiName);
  if (options.apiId) apis = apis.filter((api) => api.apiId === options.apiId);

  if (apis.length === 0) {
    throw new Error(
      `No AppSync API found matching filters (apiName=${options.apiName}, apiId=${options.apiId}).`,
    );
  }

  if (apis.length > 1) {
    const names = apis.map((api) => `${api.name} (${api.apiId})`).join(", ");
    throw new Error(`Multiple AppSync APIs found: ${names}. Set apiName or apiId to disambiguate.`);
  }

  const url = apis[0]?.uris?.GRAPHQL;
  if (!url) {
    throw new Error(`AppSync API "${apis[0]?.name}" has no GRAPHQL URI.`);
  }

  return { url, region };
}

async function resolveConnection(
  options: NeptuneClientOptions,
  credentials: AwsClientConfig["credentials"],
): Promise<{ url: string; region: string }> {
  if (options.url) {
    return {
      url: options.url,
      region: options.region ?? extractRegionFromUrl(options.url),
    };
  }

  return discoverAppSyncEndpoint(options, credentials);
}

function createAwsHelpers(region: string, credentials: AwsClientConfig["credentials"]) {
  const awsConfig = (): AwsClientConfig => ({ region, credentials });

  return {
    awsConfig,
    aws<T>(Client: AwsClientConstructor<T>, config: Record<string, unknown> = {}): T {
      return new Client({
        ...config,
        ...awsConfig(),
      });
    },
  };
}

async function executeQuery(
  url: string,
  signer: AppSyncSigner,
  type: QueryType,
  query: string,
): Promise<unknown> {
  const body = buildExecuteQueryPayload(type, query);
  const headers = await signer.signRequest(body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return parseAppSyncResponse((await response.json()) as GraphQLResponse);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS / 1000}s. AppSync has a 29s backend timeout — your query may be too expensive.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function runCypher(
  execute: (type: QueryType, query: string) => Promise<unknown>,
  queryOrBuilder: string | CypherBuilder,
): Promise<unknown> {
  const query = typeof queryOrBuilder === "string" ? queryOrBuilder : buildCypherQuery(queryOrBuilder);
  return execute("cypher", query);
}

export async function createClient(options: NeptuneClientOptions): Promise<NeptuneClient> {
  const credentials = createCredentialProvider(options.profile);
  const { url, region } = await resolveConnection(options, credentials);
  const signer = new AppSyncSigner(url, credentials, region);
  const awsHelpers = createAwsHelpers(region, credentials);
  const runQuery = (type: QueryType, query: string) => executeQuery(url, signer, type, query);

  return {
    region,
    g: createTraversalSource,
    ...awsHelpers,
    gremlin<T = unknown>(queryOrTraversal: GremlinInput): Promise<T> {
      const query = isTraversal(queryOrTraversal) ? toGremlinScript(queryOrTraversal) : queryOrTraversal;
      return runQuery("gremlin", query) as Promise<T>;
    },
    cypher<T = unknown>(queryOrBuilder: string | CypherBuilder): Promise<T> {
      return runCypher(runQuery, queryOrBuilder) as Promise<T>;
    },
  };
}
