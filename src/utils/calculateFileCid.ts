import { importer } from "ipfs-unixfs-importer";
import { BlackHoleBlockstore } from "blockstore-core";

export default async function calculateFileCid(file: File): Promise<string> {
  const blockstore = new BlackHoleBlockstore();
  const source = [
    {
      path: file.name,
      content: new Uint8Array(await file.arrayBuffer()),
    },
  ];

  for await (const entry of importer(source, blockstore)) {
    if (entry.path === file.name) {
      return entry.cid.toString();
    }
  }

  throw new Error(`Failed to calculate CID for ${file.name}`);
}
