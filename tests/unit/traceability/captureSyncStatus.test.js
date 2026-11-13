import { describe, expect, it } from 'vitest';

import {
    CaptureSyncStatus,
    ServerSyncResult,
    resolveCaptureStatus
} from '../../../src/modules/traceability/application/synchronization/captureSyncStatus.js';

describe('Capture synchronization status', () => {
    it('keeps a capture pending without server confirmation', () => {
        const status = resolveCaptureStatus(
            CaptureSyncStatus.PENDING,
            null
        );

        expect(status).toBe(CaptureSyncStatus.PENDING);
    });

    it.each([
        [ServerSyncResult.ACCEPTED, CaptureSyncStatus.ACCEPTED],
        [ServerSyncResult.ALREADY_PROCESSED, CaptureSyncStatus.ACCEPTED],
        [ServerSyncResult.CONFLICT, CaptureSyncStatus.CONFLICT],
        [ServerSyncResult.REJECTED, CaptureSyncStatus.REJECTED]
    ])('maps server result %s to %s', (serverResult, expected) => {
        expect(
            resolveCaptureStatus(CaptureSyncStatus.PENDING, serverResult)
        ).toBe(expected);
    });

    it('rejects unknown server results', () => {
        expect(() =>
            resolveCaptureStatus(CaptureSyncStatus.PENDING, 'Unknown')
        ).toThrow('Unknown server synchronization result');
    });

    it('prevents changing an accepted capture to rejected', () => {
        expect(() =>
            resolveCaptureStatus(
                CaptureSyncStatus.ACCEPTED,
                ServerSyncResult.REJECTED
            )
        ).toThrow(
            'A resolved capture cannot change status automatically'
        );
    });

    it('allows repeated confirmation of the same state', () => {
        expect(
            resolveCaptureStatus(
                CaptureSyncStatus.ACCEPTED,
                ServerSyncResult.ALREADY_PROCESSED
            )
        ).toBe(CaptureSyncStatus.ACCEPTED);
    });
});