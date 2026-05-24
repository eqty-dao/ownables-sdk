import {
  AnchorClient,
  Binary,
  Event,
  Message,
  ViemContract,
  ViemSigner,
} from "eqty-core";
import type { PublicClient, WalletClient } from "viem";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const ZERO_HASH = Binary.fromHex("0x" + "0".repeat(64));

/**
 * EQTYService
 */
export default class EQTYService {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private anchorClient: AnchorClient<any>;
  private anchorQueue: Array<{ key: Binary; value: Binary }> = [];
  public readonly signer: ViemSigner;

  private getChain() {
    switch (this.chainId) {
      case base.id:
        return base;
      case baseSepolia.id:
        return baseSepolia;
      default:
        throw new Error(`Unsupported chain ID: ${this.chainId}`);
    }
  }

  public constructor(
    public readonly address: string,
    public readonly chainId: number,
    walletClient?: WalletClient,
    publicClient?: PublicClient
  ) {
    const chain = this.getChain();
    const eth = EQTYService.ethereum;

    this.walletClient =
      walletClient ||
      (() => {
        if (!eth)
          throw new Error("No Ethereum provider found. Connect a wallet.");
        return createWalletClient({
          account: getAddress(address),
          chain,
          transport: custom(eth),
        }) as WalletClient;
      })();

    this.publicClient =
      publicClient ||
      (createPublicClient({
        chain,
        transport: eth ? custom(eth) : http(chain.rpcUrls.default.http[0]),
      }) as PublicClient);

    const contract = new ViemContract(
      this.publicClient,
      this.walletClient,
      AnchorClient.contractAddress(this.chainId)
    );
    this.anchorClient = new AnchorClient(contract);

    this.signer = new ViemSigner(this.walletClient);
  }

  private static get ethereum(): any {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }

  async anchor(
    ...anchors:
      | Array<{
          key: { hex: string } | Binary;
          value: { hex: string } | Binary;
        }>
      | Array<{ hex: string } | Binary>
  ): Promise<void> {
    if (anchors.length === 0) return;
    const toBinary = (b: any) =>
      b instanceof Binary ? b : Binary.fromHex(b.hex);
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && (first as any).hex)) {
      const list = (anchors as Array<any>).map((b) => toBinary(b));
      for (const val of list) {
        this.anchorQueue.push({ key: val, value: ZERO_HASH });
      }
    } else {
      const list = (anchors as Array<any>).map(({ key, value }) => ({
        key: toBinary(key),
        value: toBinary(value),
      }));
      this.anchorQueue.push(...list);
    }
  }

  async submitAnchors(): Promise<string | undefined> {
    if (this.anchorQueue.length === 0) return undefined;

    const payload = this.anchorQueue.slice();
    this.anchorQueue = [];
    try {
      return await this.anchorClient.anchor(payload);
    } catch (err) {
      this.anchorQueue.unshift(...payload);
      throw err;
    }
  }

  async emitPublicEvent(
    subjectId: string,
    eventType: string,
    data: Uint8Array,
    txOptions?: { value?: bigint }
  ) {
    const nextTxOptions = txOptions ?? (await this.resolveAnchorTxOptions(1));
    const transactionHash = await (this.walletClient as any).writeContract({
      account: (this.walletClient as any).account,
      address: AnchorClient.contractAddress(this.chainId) as `0x${string}`,
      abi: [
        {
          type: "function",
          name: "emitPublicEvent",
          stateMutability: "payable",
          inputs: [
            { name: "subjectId", type: "bytes32" },
            { name: "eventType", type: "string" },
            { name: "data", type: "bytes" },
          ],
          outputs: [],
        },
      ],
      functionName: "emitPublicEvent",
      args: [subjectId, eventType, data],
      value: nextTxOptions.value,
    });
    const receipt = await (this.publicClient as any).waitForTransactionReceipt({
      hash: transactionHash,
    });
    const publicEventAbi = parseAbiItem(
      "event PublicEvent(bytes32 indexed subjectId, address indexed source, string eventType, bytes data, uint64 timestamp)"
    );
    const logs = await (this.publicClient as any).getLogs({
      address: AnchorClient.contractAddress(this.chainId) as `0x${string}`,
      event: publicEventAbi,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    const log = logs.find(
      (entry: any) =>
        entry.transactionHash === transactionHash &&
        entry.args?.subjectId?.toLowerCase?.() === subjectId.toLowerCase()
    );

    if (!log) {
      throw new Error("PublicEvent log not found in transaction receipt");
    }

    return {
      source: log.args.source as string,
      eventType: log.args.eventType as string,
      data:
        typeof log.args.data === "string"
          ? Binary.fromHex(log.args.data).hex
          : new Binary(log.args.data as Uint8Array).hex,
      blockNumber: Number(receipt.blockNumber),
      transactionHash,
      transactionIndex: Number(receipt.transactionIndex ?? receipt.index ?? 0),
      logIndex: Number(log.logIndex),
    };
  }

  async quoteEqtyCost(count: bigint): Promise<bigint> {
    return (await (this.publicClient as any).readContract({
      address: AnchorClient.contractAddress(this.chainId),
      abi: [
        {
          name: "quoteEqtyCost",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "count", type: "uint256" }],
          outputs: [{ name: "cost", type: "uint256" }],
        },
      ],
      functionName: "quoteEqtyCost",
      args: [count],
    })) as bigint;
  }

  async quoteEthCost(count: bigint): Promise<bigint> {
    return (await (this.publicClient as any).readContract({
      address: AnchorClient.contractAddress(this.chainId),
      abi: [
        {
          name: "quoteEthCost",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "count", type: "uint256" }],
          outputs: [{ name: "cost", type: "uint256" }],
        },
      ],
      functionName: "quoteEthCost",
      args: [count],
    })) as bigint;
  }

  async eqtyToken(): Promise<string> {
    return (await (this.publicClient as any).readContract({
      address: AnchorClient.contractAddress(this.chainId),
      abi: [
        {
          name: "eqtyToken",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "token", type: "address" }],
        },
      ],
      functionName: "eqtyToken",
      args: [],
    })) as string;
  }

  async allowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<bigint> {
    return (await (this.publicClient as any).readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ name: "remaining", type: "uint256" }],
        },
      ],
      functionName: "allowance",
      args: [owner, spender],
    })) as bigint;
  }

  private async resolveAnchorTxOptions(count: number): Promise<{ value?: bigint }> {
    const batchSize = BigInt(count);
    const quotedEqtyCost = await this.quoteEqtyCost(batchSize);

    if (quotedEqtyCost === 0n) {
      return { value: 0n };
    }

    const eqtyTokenAddress = await this.eqtyToken();
    if (eqtyTokenAddress !== zeroAddress) {
      const anchorAddress = AnchorClient.contractAddress(this.chainId);
      const allowance = await this.allowance(
        eqtyTokenAddress,
        this.address,
        anchorAddress
      );

      if (allowance >= quotedEqtyCost) {
        return { value: 0n };
      }
    }

    const quotedEthCost = await this.quoteEthCost(batchSize);
    return { value: quotedEthCost };
  }

  async sign(...subjects: Array<Event | Message>): Promise<void> {
    for (const subject of subjects) {
      await subject.signWith(this.signer);
    }
  }

  async verifyAnchors(...anchors: any[]): Promise<{
    verified: boolean;
    anchors: Record<string, string | undefined>;
    map: Record<string, string>;
  }> {
    if (anchors.length === 0) {
      return { verified: false, anchors: {}, map: {} };
    }

    const contractAddress = AnchorClient.contractAddress(this.chainId);
    const anchorsMap: Record<string, string> = {};
    const txHashes: Record<string, string | undefined> = {};
    let allVerified = true;

    const anchorPairs: Array<{ key: Binary; value: Binary }> = [];

    const toBinary = (b: any) =>
      b instanceof Binary ? b : Binary.fromHex(b.hex);
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && (first as any).hex)) {
      for (const anchor of anchors as Array<any>) {
        const key = toBinary(anchor);
        anchorPairs.push({ key, value: ZERO_HASH });
      }
    } else {
      for (const anchor of anchors as Array<any>) {
        anchorPairs.push({
          key: toBinary(anchor.key),
          value: toBinary(anchor.value),
        });
      }
    }

    const anchoredEvent = parseAbiItem(
      "event Anchored(bytes32 indexed key, bytes32 value, address indexed sender, uint64 timestamp)"
    );

    const currentBlock = await (this.publicClient as any).getBlockNumber();
    const maxBlockRange = BigInt(100000);
    const fromBlock =
      currentBlock > maxBlockRange ? currentBlock - maxBlockRange : BigInt(0);

    for (const { key, value } of anchorPairs) {
      try {
        const logs = await (this.publicClient as any).getLogs({
          address: contractAddress as `0x${string}`,
          event: anchoredEvent,
          args: {
            key: key.hex as `0x${string}`,
          },
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        if (logs.length > 0) {
          const latestLog = logs[logs.length - 1];
          txHashes[key.hex] = latestLog.transactionHash;

          if (value.hex !== ZERO_HASH.hex) {
            const logValue = (latestLog.args as any).value;
            const normalizedLogValue =
              typeof logValue === "string" ? logValue.toLowerCase() : logValue;
            const normalizedExpectedValue = value.hex.toLowerCase();

            anchorsMap[key.hex] = normalizedLogValue;

            if (normalizedLogValue !== normalizedExpectedValue) {
              allVerified = false;
            }
          } else {
            anchorsMap[key.hex] = value.hex.toLowerCase();
          }
        } else {
          txHashes[key.hex] = undefined;
          anchorsMap[key.hex] = value.hex.toLowerCase();
          allVerified = false;
        }
      } catch (error) {
        console.error(`Failed to verify anchor ${key.hex}:`, error);
        txHashes[key.hex] = undefined;
        anchorsMap[key.hex] = value.hex.toLowerCase();
        allVerified = false;
      }
    }

    return {
      verified: allVerified,
      anchors: txHashes,
      map: anchorsMap,
    };
  }
}
