import { prepareDossier } from "@ownables/builder";
import type { PackageService as BrowserPackageService } from "@ownables/platform-browser/dist/platform-browser/src/index.js";
import type { TypedPackage } from "@/interfaces/TypedPackage";

export interface CreateOwnableInput {
  name: string;
  description: string;
  thumbnail?: File;
}

const normalizeMultiline = (value: string): string =>
  value.replace(/\r\n/g, "\n").trim();

export default class BuilderService {
  constructor(
    private readonly packageService: Pick<
      BrowserPackageService,
      "extractAssets" | "processPackage"
    >
  ) {}

  async createOwnable(input: CreateOwnableInput): Promise<TypedPackage> {
    const name = normalizeMultiline(input.name);
    const description = normalizeMultiline(input.description);

    const prepared = await prepareDossier({
      name,
      description,
      ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
      packageService: this.packageService,
    });

    return prepared.pkg as TypedPackage;
  }
}
