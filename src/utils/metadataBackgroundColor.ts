export function normalizeMetadataBackgroundColor(value?: string): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) {
    return undefined;
  }

  return `#${hex}`;
}
