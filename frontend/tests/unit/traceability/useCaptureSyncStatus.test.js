import { describe, expect, it } from 'vitest';

import {
    useCaptureSyncStatus
} from '../../../src/modules/traceability/presentation/composables/useCaptureSyncStatus.js';

const CLIENT_EVENT_ID = '11111111-1111-4111-8111-111111111111';

describe('useCaptureSyncStatus', () => {
    it('starts with a pending capture', () => {
        const capture = useCaptureSyncStatus(CLIENT_EVENT_ID);

        expect(capture.status.value).toBe('Pending');
        expect(capture.isPending.value).toBe(true);
        expect(capture.isAccepted.value).toBe(false);
    });

    it('accepts a confirmed event', () => {
        const capture = useCaptureSyncStatus(CLIENT_EVENT_ID);

        capture.applyServerResult({
            clientEventId: CLIENT_EVENT_ID,
            status: 'Accepted'
        });

        expect(capture.status.value).toBe('Accepted');
        expect(capture.isAccepted.value).toBe(true);
    });

    it('keeps the capture pending without a response', () => {
        const capture = useCaptureSyncStatus(CLIENT_EVENT_ID);

        capture.applyServerResult(null);

        expect(capture.status.value).toBe('Pending');
    });

    it('reports conflicts with a reason', () => {
        const capture = useCaptureSyncStatus(CLIENT_EVENT_ID);

        capture.applyServerResult({
            clientEventId: CLIENT_EVENT_ID,
            status: 'Conflict',
            reason: 'Event identifier contains different data'
        });

        expect(capture.status.value).toBe('Conflict');
        expect(capture.needsAttention.value).toBe(true);
        expect(capture.reason.value).toContain('different data');
    });

    it('does not apply results from another capture', () => {
        const capture = useCaptureSyncStatus(CLIENT_EVENT_ID);

        expect(() =>
            capture.applyServerResult({
                clientEventId: '22222222-2222-4222-8222-222222222222',
                status: 'Accepted'
            })
        ).toThrow('Synchronization result belongs to another capture');

        expect(capture.status.value).toBe('Pending');
    });
});