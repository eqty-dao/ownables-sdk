import { Binary } from "eqty-core";

type EqtyWithEmitPublicEvent = {
  emitPublicEvent(
    subjectId: string,
    eventType: string,
    data: Uint8Array | string,
    txOptions?: { value?: bigint }
  ): Promise<unknown>;
};

export function normalizeBrowserEqty<T extends EqtyWithEmitPublicEvent>(provider: T): T {
  const originalEmitPublicEvent = provider.emitPublicEvent.bind(provider);

  async function normalizedEmitPublicEvent(
    subjectId: string,
    eventType: string,
    data: Uint8Array | string,
    txOptions?: { value?: bigint }
  ) {
    const normalizedData =
      typeof data === "string" ? data : new Binary(data).hex;

    return originalEmitPublicEvent(
      subjectId,
      eventType,
      normalizedData as never,
      txOptions
    );
  }

  return Object.assign(provider, {
    emitPublicEvent: normalizedEmitPublicEvent,
  });
}
