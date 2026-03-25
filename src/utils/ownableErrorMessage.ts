// Re-throw error if not an error from an Ownable smart contract.

export default function ownableErrorMessage(error: any): string {
  if (!(error instanceof Error)) {
    return typeof error === "string" ? error : "Internal error";
  }

  const message = error.message;

  if (message.match(/^Ownable \w+ failed$/) && error.cause instanceof Error) {
    console.error(error.cause);
    return error.cause.message.replace(/^Custom Error val: "(.+)"$/, "$1");
  }

  console.error(error);

  // Handle viem style errors - strictly use the summary
  return message.replace(/\..+$/s, '');
}
