import { resolveCaptureStatus } from '../../../application/synchronization/captureSyncStatus.js';

export class IndexedDbCaptureRepository {
  constructor({ name = 'eventore-sprint1', factory = globalThis.indexedDB } = {}) {
    this.name = name; this.factory = factory; this.db = null;
  }
  async open() {
    if (this.db) return this.db;
    if (!this.factory) throw new Error('IndexedDB no disponible');
    this.db = await new Promise((resolve,reject) => {
      const req = this.factory.open(this.name,1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('captures',
          { keyPath: ['tenantId','clientEventId'] });
        store.createIndex('pending',['tenantId','sourceId','status']);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Cierra la otra pestaña y reintenta'));
      req.onsuccess = () => {
        req.result.onversionchange = () => this.close();
        resolve(req.result);
      };
    });
    return this.db;
  }
  async transaction(mode, action) {
    const db = await this.open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction('captures',mode);
      let value;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar'));
      tx.onabort = () => reject(tx.error ?? new Error('Operación cancelada'));
      try { action(tx.objectStore('captures'),v => { value = v; },tx); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  save(capture) {
    return this.transaction('readwrite',store => store.add(capture));
  }
  get({ tenantId,clientEventId }) {
    return this.transaction('readonly',(store,set) => {
      store.get([tenantId,clientEventId]).onsuccess = e => set(e.target.result ?? null);
    });
  }
  listPending({ tenantId,sourceId }) {
    return this.transaction('readonly',(store,set) => {
      store.index('pending').getAll([tenantId,sourceId,'Pending'])
        .onsuccess = e => set(e.target.result);
    });
  }
  list({ tenantId }) {
    return this.transaction('readonly',(store,set) => {
      store.getAll().onsuccess = e =>
        set(e.target.result.filter(c => c.tenantId === tenantId));
    });
  }
  applyOutcome({ tenantId,clientEventId,outcome }) {
    return this.transaction('readwrite',(store,set,tx) => {
      store.get([tenantId,clientEventId]).onsuccess = e => {
        try {
          const capture = e.target.result;
          if (!capture) throw new Error('Captura inexistente');
          const status = resolveCaptureStatus(capture.status,outcome.status);
          store.put({ ...capture,status,reason: outcome.reason ?? null,
            lotId: outcome.lotId ?? capture.lotId });
          set(status);
        } catch (error) { tx.abort(); }
      };
    });
  }
  close() { this.db?.close(); this.db = null; }
}
