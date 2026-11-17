// Re-throw error if not an error from an Ownable smart contract.

export const WALLET_REJECTION_MESSAGE = "Wallet request cancelled";

export function isWalletRejection(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (
    let depth = 0;
    depth < 20 && current && typeof current === "object" && !seen.has(current);
    depth += 1
  ) {
    seen.add(current);
    const candidate = current as {
      code?: unknown;
      cause?: unknown;
    };
    if (candidate.code === 4001) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

export default function ownableErrorMessage(error: any): string {
  if (!(error instanceof Error)) {
    console.error("Non-Error thrown value:", error);
    return typeof error === "string" ? error : "Internal error";
  }

  const message = error.message;
  const viemShortMessage = (error as any).shortMessage;

  console.error(error);

  const contractMessage =
    /^Ownable \w+ failed$/.test(message) && error.cause instanceof Error
      ? error.cause.message
      : message;
  const customError = /^(?:Ownable ABI call failed: \S+ )?Custom Error val: "([\s\S]*)"$/.exec(
    contractMessage
  );
  if (customError) return customError[1];
  if (contractMessage !== message) return contractMessage;

  // Handle viem style errors by returning their explicit short summary.
  if (typeof viemShortMessage === "string" && viemShortMessage.trim() !== "") {
    return viemShortMessage.trim();
  }

  // Fallback detection for viem-formatted messages when shortMessage isn't present.
  if (/\bviem@/i.test(message) || /\nVersion:\s*viem@/i.test(message)) {
    const firstLine = message.split("\n").find((line) => line.trim() !== "");
    if (firstLine) return firstLine.trim();
  }

  // Keep full message for non-viem errors (e.g. WebAssembly instantiate errors).
  return message;
}
