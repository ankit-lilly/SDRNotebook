import { assertEquals, assertExists } from "@std/assert";
import { ApiGatewaySigner, extractRegionFromUrl } from "./signer.ts";

Deno.test("extractRegionFromUrl parses API Gateway URL", () => {
  const url =
    "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api/v1/internal/neptune/query";
  assertEquals(extractRegionFromUrl(url), "us-east-1");
});

Deno.test("extractRegionFromUrl parses eu-west-1", () => {
  const url =
    "https://xyz.execute-api.eu-west-1.amazonaws.com/dev/api/v1/internal/neptune/query";
  assertEquals(extractRegionFromUrl(url), "eu-west-1");
});

Deno.test("extractRegionFromUrl throws for non-API Gateway URL", () => {
  let threw = false;
  try {
    extractRegionFromUrl(
      "https://example.com/dev/api/v1/internal/neptune/query",
    );
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("ApiGatewaySigner.signRequest adds authorization headers", async () => {
  const mockCredentials = () =>
    Promise.resolve({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      sessionToken: "FwoGZXIvYXdzEA==EXAMPLE",
    });

  const signer = new ApiGatewaySigner(
    "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api/v1/internal/neptune/query",
    mockCredentials,
    "us-east-1",
  );

  const body = JSON.stringify({ query: "{ __typename }" });
  const headers = await signer.signRequest(body);

  assertExists(headers["authorization"]);
  assertEquals(
    headers["authorization"].includes("/us-east-1/execute-api/aws4_request"),
    true,
  );
  assertExists(headers["x-amz-date"]);
  assertExists(headers["x-amz-security-token"]);
  assertEquals(headers["content-type"], "application/json");
  assertEquals(headers["host"], "abc123.execute-api.us-east-1.amazonaws.com");
});
