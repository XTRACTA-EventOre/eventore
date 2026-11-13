<script setup>
import { computed } from 'vue';

import {
  CaptureSyncStatus
} from '../../application/synchronization/captureSyncStatus.js';

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: ''
  }
});

const statusLabels = Object.freeze({
  [CaptureSyncStatus.PENDING]: 'Pending synchronization',
  [CaptureSyncStatus.ACCEPTED]: 'Accepted by server',
  [CaptureSyncStatus.CONFLICT]: 'Synchronization conflict',
  [CaptureSyncStatus.REJECTED]: 'Capture rejected'
});

const statusLabel = computed(
    () => statusLabels[props.status] ?? 'Unknown status'
);

const requiresAttention = computed(() =>
    [
      CaptureSyncStatus.CONFLICT,
      CaptureSyncStatus.REJECTED
    ].includes(props.status)
);
</script>

<template>
  <div role="status" aria-live="polite">
    <strong>{{ statusLabel }}</strong>

    <p v-if="requiresAttention && reason">
      {{ reason }}
    </p>
  </div>
</template>