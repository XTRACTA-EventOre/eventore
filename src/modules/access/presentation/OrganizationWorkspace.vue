<script setup>
import {onMounted,ref} from 'vue';
import {requestApi} from '../../../shared/infrastructure/http/apiClient.js';
import {apiUrl} from '../../../shared/infrastructure/http/apiUrl.js';
const props=defineProps({manageBilling:Boolean,manageKeys:Boolean});
const billing=ref(null),keys=ref([]),token=ref(''),message=ref(''),busy=ref(false);
const billingPath='/api/v1/auth/billing',keyPath='/api/v1/jewelry/erp/keys';
async function load(){
 if(props.manageBilling)billing.value=await requestApi(billingPath);
 if(props.manageKeys)keys.value=(await requestApi(keyPath)).keys;
}
async function apply(path){
 busy.value=true;message.value='';token.value='';
 try{const result=await requestApi(path,{method:'POST'});token.value=result.token??'';
 message.value=result.effectiveAt?'Cambio programado para '+new Date(result.effectiveAt).toLocaleDateString():result.token?'Guarda la clave para configurar el ERP.':'Orden de pago pendiente de confirmación: '+result.id;await load();}
 catch(e){message.value=e.message;}finally{busy.value=false;}
}
onMounted(()=>load().catch(e=>message.value=e.message));
</script>
<template><section class="panel"><h2>Organización</h2><p role="status">{{message}}</p>
<section v-if="manageKeys"><h3>Integración ERP</h3><button :disabled="busy" @click="apply(keyPath)">Generar clave ERP</button>
<p v-if="token">Clave de uso privado <code>{{token}}</code></p><ul><li v-for="k in keys" :key="k.id">{{k.id}} · {{k.revoked?'Revocada':'Activa'}} <button v-if="!k.revoked" :disabled="busy" @click="apply(keyPath+'/'+k.id+'/rotate')">Rotar clave</button></li></ul></section>
<section v-if="billing"><h3>Plan {{billing.subscription.plan}}</h3><p>{{billing.features.join(' · ')}}</p>
<p v-if="billing.subscription.next_plan">Cambio a {{billing.subscription.next_plan}} el {{new Date(billing.subscription.cycle_end).toLocaleDateString()}}</p>
<button v-if="billing.subscription.plan==='Base'" :disabled="busy" @click="apply(billingPath+'/upgrade')">Solicitar plan Pro · S/ {{(billing.priceMinor/100).toFixed(2)}}</button>
<button v-else-if="!billing.subscription.next_plan" :disabled="busy" @click="apply(billingPath+'/downgrade')">Programar cambio a Base</button>
<h3>Historial de facturación</h3><a v-if="billing.subscription.plan==='Pro'" :href="apiUrl(billingPath+'/history.csv')">Descargar historial CSV</a><p v-if="!billing.history.length">Aún no hay órdenes.</p>
<ul><li v-for="o in billing.history" :key="o.id">{{new Date(o.created_at).toLocaleDateString()}} · {{o.currency}} {{(o.amount_minor/100).toFixed(2)}} · {{({Paid:'Pagado',Pending:'Pendiente',Rejected:'Rechazado'})[o.status]}} <span v-if="o.period_end"> · {{new Date(o.period_start).toLocaleDateString()}} – {{new Date(o.period_end).toLocaleDateString()}}</span> <a v-if="o.status==='Paid'" :href="apiUrl(billingPath+'/documents/'+o.id)">Descargar comprobante</a></li></ul></section></section></template>
