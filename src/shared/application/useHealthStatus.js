import { ref, onMounted } from 'vue';

import { getHealthStatus } from
        '../infrastructure/http/healthApi.js';

export function useHealthStatus() {
    const connectionStatus = ref('Checking connection...');
    const isConnected = ref(false);

    async function checkConnection() {
        try {
            const healthStatus = await getHealthStatus();

            isConnected.value = true;
            connectionStatus.value =
                `Connected to ${healthStatus.service}`;
        } catch {
            isConnected.value = false;
            connectionStatus.value = 'Backend unavailable';
        }
    }

    onMounted(checkConnection);

    return {
        connectionStatus,
        isConnected
    };
}