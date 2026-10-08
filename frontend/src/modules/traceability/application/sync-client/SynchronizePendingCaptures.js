export function createSynchronizationApi({ fetchImpl = fetch,
                                             getHeaders = () => ({}),timeoutMs = 12000 } = {}) {
    return { async send(body) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(),timeoutMs);
            try {
                const response = await fetchImpl('/api/v1/events/synchronize',{
                    method: 'POST',headers: { ...getHeaders(),'Content-Type': 'application/json' },
                    body: JSON.stringify(body),signal: controller.signal });
                if (!response.ok) {
                    const error = new Error(`Sin confirmar HTTP ${response.status}`);
                    error.status = response.status; throw error;
                }
                return await response.json();
            } finally { clearTimeout(timer); }
        } };
}

export class SynchronizePendingCaptures {
    constructor({ repository,api,tenantId,sourceId }) {
        Object.assign(this,{ repository,api,tenantId,sourceId });
        this.inFlight = null;
    }
    execute() {
        if (this.inFlight) return this.inFlight;
        this.inFlight = this.run().finally(() => { this.inFlight = null; });
        return this.inFlight;
    }
    async run() {
        const captures = await this.repository.listPending({
            tenantId: this.tenantId,sourceId: this.sourceId });
        if (!captures.length) return [];
        const events = captures.map(({ clientEventId,eventType,occurredAt,dependencies,payload }) =>
            ({ clientEventId,eventType,occurredAt,dependencies,payload }));
        const { results } = await this.api.send({ sourceId: this.sourceId,events });
        const ids = new Set(events.map(e => e.clientEventId));
        const seen = new Set();
        if (!Array.isArray(results)) throw new Error('Respuesta incompleta');
        for (const result of results) {
            if (!ids.has(result.clientEventId) || seen.has(result.clientEventId) ||
                !['Accepted','AlreadyProcessed','Conflict','Rejected'].includes(result.status) ||
                (['Accepted','AlreadyProcessed'].includes(result.status) && !result.lotId)) {
                throw new Error('Respuesta inválida; se conservan los pendientes');
            }
            seen.add(result.clientEventId);
        }
        for (const outcome of results) {
            await this.repository.applyOutcome({ tenantId: this.tenantId,
                clientEventId: outcome.clientEventId,outcome });
        }
        return results;
    }
}

export function startAutoSync({ sync,target = window,onChange = () => {},
                                  onError = () => {} }) {
    let stopped = false, timer, attempt = 0;
    async function run() {
        if (stopped) return;
        clearTimeout(timer);
        try { await sync.execute(); attempt = 0; if (!stopped) onChange(); }
        catch (error) {
            if (stopped) return;
            onError(error.message);
            if ([400,401,403].includes(error.status)) return;
            const delay = Math.min(60000,1000 * 2 ** Math.min(attempt++,6));
            timer = setTimeout(run,delay + Math.floor(Math.random() * 300));
        }
    }
    target.addEventListener('online',run);
    run();
    return { run,stop() {
            stopped = true; clearTimeout(timer); target.removeEventListener('online',run);
        } };
}