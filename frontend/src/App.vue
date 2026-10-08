<script setup>
import { useHealthStatus } from
      './shared/application/useHealthStatus.js';

const {
  connectionStatus,
  isConnected
} = useHealthStatus();
</script>

<template>
  <main class="container">
    <h1>EventOre</h1>

    <p>Mineral Traceability Platform</p>

    <section class="status">
      <h2>System Status</h2>

      <p :class="{ connected: isConnected }">
        {{ connectionStatus }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.container {
  max-width: 900px;
  margin: 100px auto;
  text-align: center;
  font-family: Arial, sans-serif;
}

.status {
  margin-top: 40px;
}

.connected {
  color: green;
  font-weight: bold;
}
</style>