import { describe, it, expect } from 'vitest';
import { createOfflineCapture } from '../../src/modules/traceability/domain/capture/OfflineCapture.js';

const input = weight => ({ tenantId: 'tenant', sourceId: 'device', uuid: () => 'event',
  payload: { mineralType: 'Gold', weight, weightUnit: 'kg', originEvidence: { reference: 'REF', source: 'Mina' } } });
describe('exact weight compatible with the API', () => {
  it('preserves the maximum supported decimal as text for offline synchronization', () => {
    const weight = '9'.repeat(35) + '.' + '1'.repeat(30);
    expect(createOfflineCapture(input(weight)).payload.weight).toBe(weight);
  });
  it.each(['9'.repeat(36), '0.' + '1'.repeat(31)])('rejects unsupported precision before saving offline', weight => {
    expect(() => createOfflineCapture(input(weight))).toThrow('35 dígitos enteros y 30 decimales');
  });
});
