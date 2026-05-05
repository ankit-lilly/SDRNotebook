import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";

/** Extract AWS region from an AppSync URL hostname */
export function extractRegionFromUrl(url: string): string {
  const hostname = new URL(url).hostname;
  const match = hostname.match(/appsync-api\.([a-z0-9-]+)\.amazonaws\.com/);
  if (!match || !match[1]) {
    throw new Error(
      `Cannot extract region from URL: ${url}. Expected an AppSync URL like https://<id>.appsync-api.<region>.amazonaws.com/graphql`,
    );
  }
  return match[1];
}

type CredentialProvider = () => Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}>;

/**
 * Signs HTTP requests for AWS AppSync using SigV4.
 * Converts between Smithy HttpRequest and standard fetch headers.
 */
export class AppSyncSigner {
  private readonly signer: SignatureV4;
  private readonly url: URL;
  private readonly credentials: CredentialProvider;

  constructor(url: string, credentials: CredentialProvider, region: string) {
    this.url = new URL(url);
    this.credentials = credentials;
    this.signer = new SignatureV4({
      service: "appsync",
      region,
      credentials,
      sha256: Sha256,
    });
  }

  /**
   * Sign a JSON body for an AppSync POST request.
   * Returns headers with keys normalized to lowercase.
   */
  async signRequest(body: string): Promise<Record<string, string>> {
    const request = new HttpRequest({
      method: "POST",
      protocol: this.url.protocol,
      hostname: this.url.hostname,
      path: this.url.pathname,
      headers: {
        "content-type": "application/json",
        host: this.url.hostname,
      },
      body,
    });

    const signed = await this.signer.sign(request);
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(signed.headers)) {
      if (typeof value === "string") {
        headers[key.toLowerCase()] = value;
      }
    }
    return headers;
  }
}
