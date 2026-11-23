import { describe,it,expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbCaptureRepository } from '../../../src/modules/traceability/infrastructure/storage/indexeddb/IndexedDbCaptureRepository.js';
import { createOfflineCapture } from '../../../src/modules/traceability/domain/capture/OfflineCapture.js';
import { SynchronizePendingCaptures } from '../../../src/modules/traceability/application/sync-client/SynchronizePendingCaptures.js';

describe('ET16 reintento del cliente',() => {
    it('conserva Pending y el ID cuando se pierde la respuesta',async () => {
        const repo = new IndexedDbCaptureRepository({ factory: new IDBFactory() });
        const capture = createOfflineCapture({ tenantId: 'tenant-test',sourceId: 'device-01',
            payload: { mineralType: 'Gold',weight: '10',weightUnit: 'kg',
                originEvidence: { reference: 'DOC-1',source: 'Operador' } } });
        await repo.save(capture); const sent = [];
        const api = { async send(body) {
                sent.push(body);
                if (sent.length === 1) throw new Error('Respuesta perdida');
                return { results: [{ clientEventId: capture.clientEventId,
                        status: 'AlreadyProcessed',lotId: 'server-lot' }] };
            } };
        const sync = new SynchronizePendingCaptures({ repository: repo,api,
            tenantId: capture.tenantId,sourceId: capture.sourceId });
        await expect(sync.execute()).rejects.toThrow('Respuesta perdida');
        expect((await repo.get(capture)).status).toBe('Pending');
        await sync.execute();
        expect(sent[0]).toEqual(sent[1]);
        expect((await repo.get(capture)).status).toBe('Accepted');
        repo.close();
    });
});