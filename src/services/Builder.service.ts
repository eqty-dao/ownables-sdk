import { prepareOwnable } from "@ownables/builder";
import type { TypedPackage } from "@/interfaces/TypedPackage";
import type PackageService from "./Package.service";
import ownableWasmUrl from "../../ownables/basic/pkg/ownable_bg.wasm?url";
import defaultWidgetHtml from "../../ownables/basic/assets/index.html?raw";
import executeMsgSchemaJson from "../../ownables/basic/schema/execute_msg.json?raw";
import queryMsgSchemaJson from "../../ownables/basic/schema/query_msg.json?raw";

const BASIC_PACKAGE_VERSION = "0.1.0";
const QUERY_MSG_SCHEMA = JSON.parse(queryMsgSchemaJson);
const EXECUTE_MSG_SCHEMA = JSON.parse(executeMsgSchemaJson);

export interface CreateOwnableInput {
  name: string;
  description: string;
  thumbnail: File;
  widgetHtml?: string;
}

const normalizeMultiline = (value: string): string =>
  value.replace(/\r\n/g, "\n").trim();

const buildPackageManifest = (
  name: string,
  description: string
): Record<string, string> => ({
  name,
  version: BASIC_PACKAGE_VERSION,
  description,
  ownablesAbi: "1",
  wireFormat: "cbor",
});

const toJsonFile = (filename: string, value: unknown): File =>
  new File([JSON.stringify(value, null, 2)], filename, {
    type: "application/json",
  });

const loadBuilderWasm = async (): Promise<File> => {
  const response = await fetch(ownableWasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load builder wasm: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  return new File([bytes], "ownable_bg.wasm", {
    type: "application/wasm",
  });
};

const convertImageToWebp = async (file: File): Promise<File> => {
  if (file.type === "image/webp") {
    return new File([await file.arrayBuffer()], "thumbnail.webp", {
      type: "image/webp",
    });
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Failed to load image preview"));
      next.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to initialize image converter");
    }

    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92)
    );

    if (!blob) {
      throw new Error("Failed to convert image to WebP");
    }

    return new File([blob], "thumbnail.webp", { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export default class BuilderService {
  constructor(private readonly packageService: PackageService) {}

  async createOwnable(input: CreateOwnableInput): Promise<TypedPackage> {
    const name = normalizeMultiline(input.name);
    const description = normalizeMultiline(input.description);
    const widgetHtml =
      normalizeMultiline(input.widgetHtml || "") || defaultWidgetHtml.trim();

    const [thumbnail, wasm] = await Promise.all([
      convertImageToWebp(input.thumbnail),
      loadBuilderWasm(),
    ]);

    const files = [
      toJsonFile("package.json", buildPackageManifest(name, description)),
      toJsonFile("query_msg.json", QUERY_MSG_SCHEMA),
      toJsonFile("execute_msg.json", EXECUTE_MSG_SCHEMA),
      new File([widgetHtml], "index.html", { type: "text/html" }),
      thumbnail,
      wasm,
    ];

    const prepared = await prepareOwnable({
      name,
      description,
      files,
      packageService: this.packageService,
    });

    return prepared.pkg as TypedPackage;
  }
}
