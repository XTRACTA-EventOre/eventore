export const CaptureSyncStatus = Object.freeze({
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    CONFLICT: 'Conflict',
    REJECTED: 'Rejected'
});

export const ServerSyncResult = Object.freeze({
    ACCEPTED: 'Accepted',
    ALREADY_PROCESSED: 'AlreadyProcessed',
    CONFLICT: 'Conflict',
    REJECTED: 'Rejected'
});

const serverResultMapping = Object.freeze({
    [ServerSyncResult.ACCEPTED]: CaptureSyncStatus.ACCEPTED,
    [ServerSyncResult.ALREADY_PROCESSED]: CaptureSyncStatus.ACCEPTED,
    [ServerSyncResult.CONFLICT]: CaptureSyncStatus.CONFLICT,
    [ServerSyncResult.REJECTED]: CaptureSyncStatus.REJECTED
});

export function resolveCaptureStatus(
    currentStatus,
    serverStatus
) {
    if (!Object.values(CaptureSyncStatus).includes(currentStatus)) {
        throw new Error('Unknown capture synchronization status');
    }

    if (serverStatus == null) {
        return currentStatus;
    }

    if (!Object.hasOwn(serverResultMapping, serverStatus)) {
        throw new Error('Unknown server synchronization result');
    }

    const nextStatus = serverResultMapping[serverStatus];

    if (currentStatus === nextStatus) {
        return currentStatus;
    }

    if (currentStatus !== CaptureSyncStatus.PENDING) {
        throw new Error(
            'A resolved capture cannot change status automatically'
        );
    }

    return nextStatus;
}