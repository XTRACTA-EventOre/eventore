<script setup>
import { ref, watch, computed } from 'vue';
import { requestApi } from '../../../../shared/infrastructure/http/apiClient.js';
const props = defineProps({ lot: Object, identity: Object, operations: Object, custody: Object,
  pendingAcceptance: Object, busy: Boolean, online: Boolean });
const emit = defineEmits(['cancel', 'prepare', 'accept', 'refresh']);
const reason = ref(''), recipient = ref(''), transporters = ref([]);
const can = permission => props.identity?.permissions?.includes(permission);
const delivery = computed(() => props.operations?.handovers?.[0]);
const addressed = computed(() => !delivery.value?.recipientUserId || delivery.value.recipientUserId === props.identity?.userId);
const actionLabels = { Cancelled: 'Lote cancelado', HandoverPrepared: 'Entrega preparada', CustodyAccepted: 'Custodia aceptada' };
watch(() => props.lot?.lotId, () => { reason.value = ''; recipient.value = ''; });
watch(() => can('lots.release'), async allowed => {
  if (allowed) {
    try { transporters.value = (await requestApi('/api/v1/auth/transporters')).users; }
    catch { transporters.value = []; }
  }
}, { immediate: true });
</script>

<template>
  <section class="lot-operations" aria-label="Operaciones del lote">
    <div class="sectionhead"><h3>Custodia e historial</h3>
      <button type="button" class="secondary" :disabled="!online || busy" @click="emit('refresh')">Actualizar lote</button>
    </div>
    <p v-if="custody?.custody" class="alert">Custodia confirmada. El lote está en transporte.</p>
    <p v-if="custody?.custody" class="identifier">Transportista: {{ custody.custody.custodianUserId === identity.userId ? identity.email : custody.custody.custodianUserId }}</p>
    <p v-for="restriction in operations?.restrictions ?? []" :key="restriction.id" class="alert error">Transferencia restringida: {{ restriction.reason }}</p>

    <form v-if="can('lots.cancel') && lot.status === 'Registered'" @submit.prevent="emit('cancel', reason)">
      <label>Motivo de cancelación<input v-model="reason" required maxlength="1000" /></label>
      <button class="danger" :disabled="!online || busy">Cancelar lote</button>
    </form>
    <form v-if="can('lots.release') && lot.status === 'Registered'" @submit.prevent="emit('prepare', recipient || null)">
      <label>Destinatario de la entrega
        <select v-model="recipient">
          <option value="">Cualquier transportista autorizado de mi organización</option>
          <option v-for="user in transporters" :key="user.id" :value="user.id">{{ user.email }}</option>
        </select>
      </label>
      <p class="muted">La entrega preparada estará disponible durante 24 horas. Una nueva entrega reemplaza la anterior.</p>
      <button class="secondary" :disabled="!online || busy || !!operations?.restrictions?.length">Preparar entrega</button>
    </form>
    <p v-if="delivery">Entrega disponible hasta {{ new Date(delivery.expiresAt).toLocaleString('es-PE') }}.</p>
    <template v-if="can('custody.accept')">
      <p v-if="lot.status === 'Registered' && !delivery && !pendingAcceptance" class="muted">El supervisor debe preparar una entrega antes de aceptar la custodia.</p>
      <p v-if="delivery && !addressed" class="alert">La entrega está asignada a otro transportista.</p>
      <p v-if="pendingAcceptance" class="alert">Hay una aceptación sin confirmar. Reintenta para comprobar su resultado sin duplicarla.</p>
      <button v-if="pendingAcceptance || (lot.status === 'Registered' && delivery)" type="button"
        :disabled="!online || busy || (!pendingAcceptance && (!addressed || !!operations?.restrictions?.length))"
        @click="emit('accept', delivery)">{{ pendingAcceptance ? 'Reintentar confirmación de custodia' : 'Aceptar custodia' }}</button>
    </template>
    <ol v-if="operations?.history?.length" class="history-list">
      <li v-for="event in operations.history" :key="event.operationId">
        <strong>{{ actionLabels[event.action] ?? event.action }}</strong>
        <p>{{ new Date(event.occurredAt).toLocaleString('es-PE') }} · Versión {{ event.version }}</p>
        <p v-if="event.reason">Motivo: {{ event.reason }}</p>
        <p class="identifier">Responsable: {{ event.actorId }}</p>
      </li>
    </ol>
  </section>
</template>
