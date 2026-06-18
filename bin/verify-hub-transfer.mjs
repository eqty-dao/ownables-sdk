import { readFileSync } from "node:fs";

const checks = [
  {
    file: "src/hooks/useOwnableState.ts",
    includes: ['onError("The Ownable returned an error"', "throw e;"],
    excludes: [],
  },
  {
    file: "src/hooks/useOwnableTransfer.ts",
    includes: ["useService(\"hub\")", "hub.isAvailable()", "hub.uploadOwnable(", "Ownable transferred through Hub"],
    excludes: [
      "relay.isAvailable()",
      "relay.sendOwnable(",
      "Relay server is down",
      "hub.downloadOwnable(upload.cid",
      "Update Hub owner state",
      "getDeliveryStatus(",
    ],
  },
  {
    file: "src/services/ServiceContainer.ts",
    includes: ["hub: HubService", "this.register(\"hub\""],
    excludes: [],
  },
  {
    file: "src/services/Hub.service.ts",
    includes: [
      "/health",
      "/ownables/upload",
      "/packages/${encodeURIComponent(cid)}/download",
      "/ownables/${encodeURIComponent(id)}/chain",
    ],
    excludes: ["/messages", "hubReplay"],
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
