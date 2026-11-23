import { describe,it,expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbCaptureRepository } from '../../../src/modules/traceability/infrastructure/storage/indexeddb/IndexedDbCaptureRepository.js';
import { createOfflineCapture } from '../../../src/modules/traceability/domain/capture/OfflineCapture.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const input = { tenantId,sourceId: 'device-01',payload: {
        mineralType: 'Gold',weight: '125.50',weightUnit: 'kg',
        originEvidence: { reference: 'DOC-001',source: 'Operador' } } };

describe('ET08 IndexedDB',() => {
    it('recupera Pending al cerrar y abrir',async () => {
        const factory = new IDBFactory();
        const repo = new IndexedDbCaptureRepository({ name: 'recovery-test',factory });
        const capture = createOfflineCapture(input);
        await repo.save(capture); repo.close();
        const reopened = new IndexedDbCaptureRepository({ name: 'recovery-test',factory });
        expect(await reopened.get(capture)).toEqual(capture);
        expect(await reopened.listPending(input)).toHaveLength(1);
        reopened.close();
    });
    it('AlreadyProcessed pasa a Accepted sin borrar la captura',async () => {
        const repo = new IndexedDbCaptureRepository({ factory: new IDBFactory() });
        const capture = createOfflineCapture(input); await repo.save(capture);
        await repo.applyOutcome({ ...capture,outcome: {
                status: 'AlreadyProcessed',lotId: '33333333-3333-4333-8333-333333333333' } });
        const saved = await repo.get(capture);
        expect(saved.status).toBe('Accepted'); expect(saved.payload).toEqual(capture.payload);
        expect(await repo.listPending(input)).toHaveLength(0); repo.close();
    });
    it('otra organización no ve los pendientes',async () => {
        const repo = new IndexedDbCaptureRepository({ factory: new IDBFactory() });
        await repo.save(createOfflineCapture(input));
        expect(await repo.listPending({ ...input,tenantId: 'otro-tenant' })).toEqual([]);
        repo.close();
    });
});
