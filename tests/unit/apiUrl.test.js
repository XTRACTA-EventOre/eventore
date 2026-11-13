import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApiUrl, apiUrl } from '../../src/shared/infrastructure/http/apiUrl.js';
import { createSynchronizationApi } from '../../src/modules/traceability/application/sync-client/SynchronizePendingCaptures.js';

afterEach(() => vi.unstubAllEnvs());
describe('API configuration across independent deployments', () => {
  it('preserves the public API path for proxy, absolute URL and trailing slash', () => {
    expect(createApiUrl('/api', '/api/v1/auth/session')).toBe('/api/v1/auth/session');
    expect(createApiUrl('http://localhost:3000/api/', '/api/v1/lots/abc/qr')).toBe('http://localhost:3000/api/v1/lots/abc/qr');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api');
    expect(apiUrl('/api/v1/health')).toBe('http://localhost:3000/api/v1/health');
  });
  it('sends session credentials to the configured synchronization API', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    await createSynchronizationApi({ fetchImpl }).send({ events: [] });
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3000/api/v1/events/synchronize',
      expect.objectContaining({ credentials: 'include', method: 'POST' }));
  });
});
