import type { TypedPackage } from "@/interfaces/TypedPackage";

type PackageInfoReader = {
  info: (nameOrCid: string, uniqueMessageHash?: string) => TypedPackage;
};

export function maybePackageInfo(
  packages: PackageInfoReader | null | undefined,
  nameOrCid: string,
  uniqueMessageHash?: string
): TypedPackage | undefined {
  if (!packages) return undefined;

  try {
    return packages.info(nameOrCid, uniqueMessageHash);
  } catch {
    return undefined;
  }
}
