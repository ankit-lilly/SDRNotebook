import { assertEquals, assertExists } from "@std/assert";
import { AppSyncSigner, extractRegionFromUrl } from "./signer.ts";

Deno.test("extractRegionFromUrl parses AppSync URL", () => {
  const url = "https://abc123.appsync-api.us-east-1.amazonaws.com/graphql";
  assertEquals(extractRegionFromUrl(url), "us-east-1");
});

Deno.test("extractRegionFromUrl parses eu-west-1", () => {
  const url = "https://xyz.appsync-api.eu-west-1.amazonaws.com/graphql";
  assertEquals(extractRegionFromUrl(url), "eu-west-1");
});

Deno.test("extractRegionFromUrl throws for non-AppSync URL", () => {
  let threw = false;
  try {
    extractRegionFromUrl("https://example.com/graphql");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("AppSyncSigner.signRequest adds authorization headers", async () => {
  const mockCredentials = async () => ({
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    sessionToken: "FwoGZXIvYXdzEA==EXAMPLE",
  });

  const signer = new AppSyncSigner(
    "https://abc123.appsync-api.us-east-1.amazonaws.com/graphql",
    mockCredentials,
    "us-east-1",
  );

  const body = JSON.stringify({ query: "{ __typename }" });
  const headers = await signer.signRequest(body);

  assertExists(headers["authorization"]);
  assertExists(headers["x-amz-date"]);
  assertExists(headers["x-amz-security-token"]);
  assertEquals(headers["content-type"], "application/json");
  assertEquals(headers["host"], "abc123.appsync-api.us-east-1.amazonaws.com");
});
