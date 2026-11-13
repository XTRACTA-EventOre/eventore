export function createOfflineCapture({ tenantId,sourceId,payload,
                                         uuid = () => crypto.randomUUID(),clock = () => new Date().toISOString() }) {
    if (!tenantId || !sourceId?.trim()) throw new Error('Falta sesión o dispositivo');
    if (!payload?.mineralType?.trim()) throw new Error('Escribe el mineral');
    if (typeof payload.weight !== 'string' ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(payload.weight) ||
        !/[1-9]/.test(payload.weight)) throw new Error('El peso debe ser positivo');
    if (!['g','kg','t'].includes(payload.weightUnit)) throw new Error('Unidad inválida');
    if (!payload.originEvidence?.reference?.trim() ||
        !payload.originEvidence?.source?.trim()) throw new Error('Completa la evidencia');
    return { schemaVersion: 1,clientEventId: uuid(),tenantId,sourceId,
        eventType: 'LotRegistered',occurredAt: clock(),dependencies: [],
        payload: structuredClone(payload),status: 'Pending',reason: null };
}

export async function captureMineralLot({ repository,...input }) {
    const capture = createOfflineCapture(input);
    await repository.save(capture);
    return capture;
}