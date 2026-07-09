import {
  buildAnchorValidationResult,
  normalizeAnchorValidationPairs,
  type AnchorProvider,
  type AnchorValidationRecord,
  type AnchorValidationResult,
} from "@ownables/core";

type LegacyAnchorValidationResult = Omit<AnchorValidationResult, "details">;
type AnchorProviderCompatible = Omit<AnchorProvider, "verifyAnchors" | "validateAnchors"> & {
  verifyAnchors(...anchors: any[]): Promise<LegacyAnchorValidationResult | AnchorValidationResult>;
  validateAnchors?: AnchorProvider["validateAnchors"];
};

const NORMALIZED_ANCHOR_PROVIDER = Symbol.for("ownables-sdk.normalizedAnchorProvider");

function hasDetails(
  result: AnchorValidationResult | LegacyAnchorValidationResult
): result is AnchorValidationResult {
  return "details" in result;
}

export function normalizeAnchorProvider<T extends AnchorProviderCompatible>(
  provider: T
): T & AnchorProvider {
  const normalizedProvider = provider as T & AnchorProvider & {
    [NORMALIZED_ANCHOR_PROVIDER]?: true;
  };

  if (normalizedProvider[NORMALIZED_ANCHOR_PROVIDER]) {
    return normalizedProvider;
  }

  const originalVerifyAnchors = provider.verifyAnchors.bind(provider);

  async function normalizedVerifyAnchors(...anchors: any[]): Promise<AnchorValidationResult> {
    const result = (await originalVerifyAnchors(
      ...anchors
    )) as AnchorValidationResult | LegacyAnchorValidationResult;
    if (hasDetails(result)) return result;

    const pairs = normalizeAnchorValidationPairs(...anchors);
    const records: AnchorValidationRecord[] = pairs.map((pair) => {
      const key = pair.key.hex;
      const value = result.map[key] ?? pair.value.hex.toLowerCase();
      const expectedValue = pair.value.hex.toLowerCase();
      const transactionHash = result.anchors[key];

      return {
        key,
        expectedValue,
        value,
        transactionHash,
        verified: Boolean(transactionHash) && value === expectedValue,
        source: "provider",
      };
    });

    return buildAnchorValidationResult(pairs, records);
  }

  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === NORMALIZED_ANCHOR_PROVIDER) {
        return true;
      }
      if (prop === "verifyAnchors" || prop === "validateAnchors") {
        return normalizedVerifyAnchors;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T & AnchorProvider;
}
