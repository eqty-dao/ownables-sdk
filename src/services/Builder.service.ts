import { prepareOwnable } from "@ownables/builder";
import type { TypedPackage } from "@/interfaces/TypedPackage";
import type PackageService from "./Package.service";
import dossierZipUrl from "../../../ownables-js/ownables/dossier.zip?url";

export interface CreateOwnableInput {
  name: string;
  description: string;
}

const normalizeMultiline = (value: string): string =>
  value.replace(/\r\n/g, "\n").trim();

export default class BuilderService {
  constructor(private readonly packageService: PackageService) {}

  private async loadDossierFiles(): Promise<File[]> {
    const response = await fetch(dossierZipUrl);
    if (!response.ok) {
      throw new Error(`Failed to load dossier package: ${response.status}`);
    }

    const zipFile = new File([await response.blob()], "dossier.zip", {
      type: "application/zip",
    });

    return this.packageService.extractAssets(zipFile);
  }

  async createOwnable(input: CreateOwnableInput): Promise<TypedPackage> {
    const name = normalizeMultiline(input.name);
    const description = normalizeMultiline(input.description);
    const files = await this.loadDossierFiles();

    const prepared = await prepareOwnable({
      name,
      description,
      files,
      packageService: this.packageService,
    });

    return prepared.pkg as TypedPackage;
  }
}
