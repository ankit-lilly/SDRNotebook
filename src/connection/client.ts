import type {
  AwsClientConfig,
  AwsClientConstructor,
  CypherBuilder,
  GremlinInput,
  NeptuneClient,
  NeptuneClientOptions,
  QueryType,
} from "./types.ts";
import { ApiGatewaySigner, extractRegionFromUrl } from "./signer.ts";
import { createCredentialProvider } from "./auth.ts";
import {
  createTraversalSource,
  isTraversal,
  toGremlinScript,
} from "../query/gremlin.ts";
import { buildCypherQuery } from "../query/cypher.ts";
import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";

import { executeQuery } from "./transport.ts";

const REST_ENDPOINTS: Record<string, string> = {
  dev:
    "https://9nyrl8j1d5-vpce-069388414a9f87f40.execute-api.us-east-2.amazonaws.com/dev/api/v1/internal/neptune/query",
  qa:
    "https://xbaoguy6re-vpce-058757a9c034d181c.execute-api.us-east-2.amazonaws.com/qa/api/v1/internal/neptune/query",
  // prod: "https://<api-id>-<vpce-id>.execute-api.<region>.amazonaws.com/prod/api/v1/internal/neptune/query",
};

function resolveEndpointForProfile(profile: string): string {
  const lower = profile.toLowerCase();
  if (lower.includes("qa")) return REST_ENDPOINTS["qa"]!;
  if (lower.includes("prod")) {
    const url = REST_ENDPOINTS["prod"];
    if (!url) {
      throw new Error(
        `No REST endpoint configured for prod. Add it to REST_ENDPOINTS in client.ts.`,
      );
    }
    return url;
  }
  return REST_ENDPOINTS["dev"]!;
}

export async function resolveRegion(
  profile: string,
  explicitRegion?: string,
): Promise<string> {
  if (explicitRegion) return explicitRegion;
  try {
    const { configFile } = await loadSharedConfigFiles();
    const profileConfig = configFile[profile];
    if (profileConfig?.region) return profileConfig.region;
    const defaultConfig = configFile["default"];
    if (defaultConfig?.region) return defaultConfig.region;
  } catch {
    // Fall through
  }

  throw new Error(
    `AWS region could not be determined for profile "${profile}". ` +
      `Set region explicitly: createClient({ profile: "${profile}", region: "us-east-1" })`,
  );
}

function resolveConnection(
  options: NeptuneClientOptions,
): { url: string; region: string } {
  const url = options.url ?? resolveEndpointForProfile(options.profile);
  return { url, region: options.region ?? extractRegionFromUrl(url) };
}

function createAwsHelpers(
  region: string,
  credentials: AwsClientConfig["credentials"],
) {
  const awsConfig = (): AwsClientConfig => ({ region, credentials });

  return {
    awsConfig,
    aws<T>(
      Client: AwsClientConstructor<T>,
      config: Record<string, unknown> = {},
    ): T {
      return new Client({ ...config, ...awsConfig() });
    },
  };
}

export async function createClient(
  options: NeptuneClientOptions,
): Promise<NeptuneClient> {
  const credentials = createCredentialProvider(options.profile);
  const { url, region: resolvedRegion } = resolveConnection(options);
  const region = resolvedRegion ??
    await resolveRegion(options.profile, options.region);
  const signer = new ApiGatewaySigner(url, credentials, region);
  const awsHelpers = createAwsHelpers(region, credentials);

  const runQuery = (type: QueryType, query: string) =>
    executeQuery(url, signer, type, query, options.serializer);

  return {
    region,
    g: createTraversalSource,
    ...awsHelpers,
    gremlin<T = unknown>(queryOrTraversal: GremlinInput): Promise<T> {
      const query = isTraversal(queryOrTraversal)
        ? toGremlinScript(queryOrTraversal)
        : queryOrTraversal;
      return runQuery("gremlin", query) as Promise<T>;
    },
    cypher<T = unknown>(queryOrBuilder: string | CypherBuilder): Promise<T> {
      const query = typeof queryOrBuilder === "string"
        ? queryOrBuilder
        : buildCypherQuery(queryOrBuilder);
      return runQuery("cypher", query) as Promise<T>;
    },
  };
}
