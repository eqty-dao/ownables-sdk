import { describe, expect, it } from 'vitest';
import { matchesPublicEventIdentity } from './public-events-harness.ts';

describe('public-event stream duplicate identity', () => {
  const event = {
    transactionHash: '0xabc',
    logIndex: 4,
    blockNumber: 123,
  };

  it('recognizes the indexed event when Hub SSE wraps it in a delivery envelope', () => {
    expect(matchesPublicEventIdentity({ type: 'public-event', event }, event)).toBe(true);
  });

  it('does not treat a different stream event as duplicate delivery evidence', () => {
    expect(matchesPublicEventIdentity({ event: { ...event, logIndex: 5 } }, event)).toBe(false);
  });
});
