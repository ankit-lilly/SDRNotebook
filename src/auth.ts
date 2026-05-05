import { fromIni } from "@aws-sdk/credential-providers";

/**
 * Creates an AWS credential provider for the given profile.
 * Credentials are resolved on every call (not cached), ensuring
 * SSO token refreshes are picked up automatically.
 *
 * If credentials fail to resolve, throws with a message
 * directing the user to run `aws sso login --profile <profile>`.
 */
export function createCredentialProvider(profile: string) {
  const provider = fromIni({ profile });

  return async () => {
    try {
      return await provider();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("expired") ||
        message.includes("Token") ||
        message.includes("credentials")
      ) {
        throw new Error(
          `AWS credentials failed for profile "${profile}". ` +
            `Run: aws sso login --profile ${profile}\n\nOriginal error: ${message}`,
        );
      }
      throw error;
    }
  };
}
