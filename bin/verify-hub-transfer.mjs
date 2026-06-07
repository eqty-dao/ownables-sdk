import { readFileSync } from "node:fs";

const checks = [
  {
    file: "src/hooks/useOwnableTransfer.ts",
    includes: ["useService(\"hub\")", "hub.isAvailable()", "hub.uploadOwnable(", "ownerAccount"],
    excludes: [
      "relay.isAvailable()",
      "relay.sendOwnable(",
      "Relay server is down",
      "hub.downloadOwnable(upload.cid",
      "hubReplay",
      "Update Hub owner state",
    ],
  },
  {
    file: "src/services/ServiceContainer.ts",
    includes: ["hub: HubService", "this.register(\"hub\""],
    excludes: [],
  },
  {
    file: "src/services/Hub.service.ts",
    includes: ["/info", "/ownables/upload", "/ownables/${encodeURIComponent(cid)}/download"],
    excludes: ["/messages"],
  },
];

for (const check of checks) {
  const source = readFileSync(check.file, "utf8");

  for (const text of check.includes) {
    if (!source.includes(text)) {
      throw new Error(`${check.file} is missing required Hub transfer marker: ${text}`);
    }
  }

  for (const text of check.excludes) {
    if (source.includes(text)) {
      throw new Error(`${check.file} still contains legacy Relay transfer marker: ${text}`);
    }
  }
}

console.log("Hub transfer verifier passed");
