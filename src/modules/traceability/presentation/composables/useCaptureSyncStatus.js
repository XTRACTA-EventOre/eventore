import { computed, readonly, ref } from 'vue';

import {
    CaptureSyncStatus,
    resolveCaptureStatus
} from '../../application/synchronization/captureSyncStatus.js';

export function useCaptureSyncStatus(clientEventId) {
    if (
        typeof clientEventId !== 'string' ||
        clientEventId.trim().length === 0
    ) {
        throw new Error('clientEventId is required');
    }

    const status = ref(CaptureSyncStatus.PENDING);
    const reason = ref(null);

    const isPending = computed(
        () => status.value === CaptureSyncStatus.PENDING
    );

    const isAccepted = computed(
        () => status.value === CaptureSyncStatus.ACCEPTED
    );

    const needsAttention = computed(() =>
        [
            CaptureSyncStatus.CONFLICT,
            CaptureSyncStatus.REJECTED
        ].includes(status.value)
    );

    function applyServerResult(result) {
        if (result == null) {
            return;
        }

        if (result.clientEventId !== clientEventId) {
            throw new Error(
                'Synchronization result belongs to another capture'
            );
        }

        const nextStatus = resolveCaptureStatus(
            status.value,
            result.status
        );

        status.value = nextStatus;

        reason.value = needsAttention.value
            ? result.reason ?? 'Manual review required'
            : null;
    }

    return {
        status: readonly(status),
        reason: readonly(reason),
        isPending,
        isAccepted,
        needsAttention,
        applyServerResult
    };
}