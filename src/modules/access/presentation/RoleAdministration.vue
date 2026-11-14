<script setup>
import { ref, watch, onMounted } from 'vue';
import { requestApi } from '../../../shared/infrastructure/http/apiClient.js';
const emit = defineEmits(['changed']);
const users = ref([]), catalog = ref({}), selectedUser = ref(''), selectedRoles = ref([]);
const busy = ref(false), error = ref(''), notice = ref('');
const labels = { Administrator: 'Administrador', Supervisor: 'Supervisor', Operator: 'Operador', Transporter: 'Transportista', Viewer: 'Consulta' };
watch(selectedUser, id => { selectedRoles.value = [...(users.value.find(user => user.id === id)?.roles ?? [])]; notice.value = ''; });
async function load() {
  try {
    const [list, roles] = await Promise.all([requestApi('/api/v1/auth/users'), requestApi('/api/v1/auth/roles')]);
    users.value = list.users; catalog.value = roles.roles;
    if (!selectedUser.value) selectedUser.value = list.users[0]?.id ?? '';
  } catch (e) { error.value = e.message; }
}
async function save() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await requestApi(`/api/v1/auth/users/${selectedUser.value}/roles`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles: selectedRoles.value })
    });
    const user = users.value.find(user => user.id === selectedUser.value);
    if (user) user.roles = [...selectedRoles.value];
    notice.value = 'Roles actualizados. Se aplicarán en la siguiente operación protegida.';
    emit('changed');
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="panel" aria-labelledby="access-title">
    <h2 id="access-title">Roles y permisos</h2>
    <p>Administra únicamente los usuarios de tu organización. Cada cambio queda registrado.</p>
    <p v-if="error" class="alert error" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert" role="status">{{ notice }}</p>
    <form @submit.prevent="save">
      <label>Usuario a administrar
        <select v-model="selectedUser" required :disabled="busy">
          <option v-for="user in users" :key="user.id" :value="user.id">{{ user.email }}{{ user.active ? '' : ' (inactivo)' }}</option>
        </select>
      </label>
      <fieldset class="role-options"><legend>Roles asignados</legend>
        <label v-for="(_, role) in catalog" :key="role" class="checkbox-label">
          <input v-model="selectedRoles" type="checkbox" :value="role" :disabled="busy" /> {{ labels[role] ?? role }}
        </label>
      </fieldset>
      <button :disabled="busy || !selectedUser || !selectedRoles.length">{{ busy ? 'Guardando…' : 'Guardar roles' }}</button>
    </form>
  </section>
</template>
