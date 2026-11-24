import { calculateAttachmentCid } from "@ownables/core/utils";

export default async function calculateFileCid(file: File): Promise<string> {
  return calculateAttachmentCid(new Uint8Array(await file.arrayBuffer()));
}
