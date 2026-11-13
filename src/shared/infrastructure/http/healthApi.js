import { apiUrl } from './apiUrl.js';

export async function getHealthStatus() {
    const response = await fetch(apiUrl('/api/v1/health'), { credentials: 'include' });

    if (!response.ok) {
        throw new Error('Unable to connect to EventOre API');
    }

    const healthStatus = await response.json();

    if (healthStatus.status !== 'ok') {
        throw new Error('EventOre API is not healthy');
    }

    return healthStatus;
}
