// Re-throw error if not an error from an Ownable smart contract.

export default function ownableErrorMessage(error: any): string {
  if (!(error instanceof Error)) {
    console.error("Non-Error thrown value:", error);
    return typeof error === "string" ? error : "Internal error";
  }

  const message = error.message;
  const viemShortMessage = (error as any).shortMessage;

  if (message.match(/^Ownable \w+ failed$/) && error.cause instanceof Error) {
    console.error(error.cause);
    return error.cause.message.replace(/^Custom Error val: "(.+)"$/, "$1");
  }

  console.error(error);

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
