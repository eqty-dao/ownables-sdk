import { Binary, Event, Message } from "eqty-core";

type ITypedDataDomain = { name?: string; version?: string; chainId?: number; verifyingContract?: string };
type ITypedDataField = { name: string; type: string };

const DUMMY_SIG = `0x${"1".repeat(130)}`;

class MockSigner {
  constructor(private readonly address: string) {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signTypedData(
    _domain: ITypedDataDomain,
    _types: Record<string, ITypedDataField[]>,
    _value: Record<string, any>
  ): Promise<string> {
    return DUMMY_SIG;
  }
}

export default class MockEQTYService {
  public readonly signer: MockSigner;
  private anchorQueue: Array<{ key: Binary; value: Binary }> = [];

  constructor(
    public readonly address: string,
    public readonly chainId: number
  ) {
    this.signer = new MockSigner(address);
  }

  async anchor(
    ...anchors:
      | Array<{ key: { hex: string } | Binary; value: { hex: string } | Binary }>
      | Array<{ hex: string } | Binary>
  ): Promise<void> {
    if (anchors.length === 0) return;

    const toBinary = (b: any) => (b instanceof Binary ? b : Binary.fromHex(b.hex));
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && first.hex)) {
      for (const value of anchors as Array<any>) {
        const v = toBinary(value);
        this.anchorQueue.push({ key: v, value: Binary.fromHex(`0x${"0".repeat(64)}`) });
      }
      return;
    }

    for (const anchor of anchors as Array<any>) {
      this.anchorQueue.push({ key: toBinary(anchor.key), value: toBinary(anchor.value) });
    }
  }

  async submitAnchors(): Promise<string | undefined> {
    if (this.anchorQueue.length === 0) return undefined;
    this.anchorQueue = [];
    return `0x${"a".repeat(64)}`;
  }

  async sign(...subjects: Array<Event | Message>): Promise<void> {
    for (const subject of subjects) {
      await subject.signWith(this.signer as any);
    }
  }

  async verifyAnchors(...anchors: any[]): Promise<{
    verified: boolean;
    anchors: Record<string, string | undefined>;
    map: Record<string, string>;
  }> {
    const hashMap: Record<string, string | undefined> = {};
    const map: Record<string, string> = {};

    const toBinary = (b: any) => (b instanceof Binary ? b : Binary.fromHex(b.hex));
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && first.hex)) {
      for (const anchor of anchors as Array<any>) {
        const key = toBinary(anchor).hex;
        hashMap[key] = `0x${"b".repeat(64)}`;
        map[key] = Binary.fromHex(`0x${"0".repeat(64)}`).hex.toLowerCase();
      }
      return { verified: true, anchors: hashMap, map };
    }

    for (const anchor of anchors as Array<any>) {
      const key = toBinary(anchor.key).hex;
      const value = toBinary(anchor.value).hex.toLowerCase();
      hashMap[key] = `0x${"b".repeat(64)}`;
      map[key] = value;
    }

    return { verified: true, anchors: hashMap, map };
  }
}
