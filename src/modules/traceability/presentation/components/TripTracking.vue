<script setup>
import {computed,ref,watch,onBeforeUnmount,onMounted} from 'vue';
import {requestApi} from '../../../../shared/infrastructure/http/apiClient.js';
const props=defineProps({lot:Object,identity:Object,online:Boolean});
const prefix='eventore-gps:'+props.identity.tenantId+':'+props.identity.userId+':';
const active=ref(''), route=ref(null), alerts=ref([]), message=ref(''), minutes=ref(60), corridor=ref('');
const canTrack=computed(()=>props.identity.permissions.includes('shipments.checkpoint'));
const path=id=>'/api/v1/shipments/tracking/'+encodeURIComponent(id);
const post=(url,body)=>requestApi(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
let timer,disposed=false,capturing=false,flushing=false;
function stop(){active.value='';clearInterval(timer);}
async function refresh(){
 const id=props.lot?.lotId;
 if(!id||!props.online)return;
 const data=await requestApi(path(id)+'/route');
 if(props.lot?.lotId!==id||disposed)return;
 route.value=data.route;alerts.value=data.alerts;
 if(active.value===id&&!data.route?.active)stop();
}
function report(e){message.value=e.message;}
async function configure(){
 try{
  const points=corridor.value.trim().split(/\r?\n/).map(line=>{
   const parts=line.split(',').map(s=>s.trim());
   if(parts.length!==2||parts.some(s=>!s||!Number.isFinite(Number(s))))throw Error('Escribe latitud,longitud en cada línea');
   return {latitude:Number(parts[0]),longitude:Number(parts[1])};
  });
  await post(path(props.lot.lotId)+'/route',{minutes:minutes.value,corridor:points});
  await refresh();
 }catch(e){report(e);}
}
async function flush(){
 if(flushing||!props.online)return;
 flushing=true;
 try{
  const keys=Object.keys(localStorage).filter(k=>k.startsWith(prefix+'point:')).sort();
  for(const key of keys){
   if(disposed)return;
   const raw=localStorage.getItem(key);if(!raw)continue;
   const point=JSON.parse(raw);
   try{await post(path(point.lotId)+'/positions',point);}
   catch(e){
    if(!['TRIP_INACTIVE','NOT_CUSTODIAN'].includes(e.code))throw e;
    message.value='Una captura quedó fuera del período de custodia.';
   }
   localStorage.removeItem(key);
  }
 }finally{flushing=false;}
}
async function capture(){
 const id=active.value;
 if(!id||capturing||disposed)return;
 capturing=true;
 try{
  if(props.online){
   try{
    const data=await requestApi(path(id)+'/route');
    if(!data.route?.active){stop();return;}
   }catch(e){if(e.status&&e.status<500)throw e;}
  }
  if(active.value!==id||disposed)return;
  const position=await new Promise((ok,fail)=>navigator.geolocation.getCurrentPosition(ok,fail,{enableHighAccuracy:true,maximumAge:0,timeout:30000}));
  if(active.value!==id||disposed)return;
  const point={id:crypto.randomUUID(),lotId:id,occurredAt:new Date(position.timestamp).toISOString(),latitude:position.coords.latitude,longitude:position.coords.longitude};
  localStorage.setItem(prefix+'point:'+point.id,JSON.stringify(point));
  message.value='Punto guardado en este dispositivo.';
  await flush();await refresh();
 }catch(e){report(e);if(e.code===1||e.status===403||e.status===401)stop();}
 finally{capturing=false;}
}
function start(){
 if(!navigator.geolocation){message.value='Este navegador requiere acceso a ubicación en HTTPS o localhost.';return;}
 stop();active.value=props.lot.lotId;capture();timer=setInterval(capture,600000);
}
watch(()=>[props.lot?.lotId,props.lot?.status],()=>{route.value=null;alerts.value=[];refresh().catch(report);});
watch(()=>props.online,online=>{if(online)flush().then(refresh).catch(report);});
onMounted(()=>flush().then(refresh).catch(report));
onBeforeUnmount(()=>{disposed=true;stop();});
</script>
<template><section v-if="active||route||lot?.status==='InTransit'" class="panel">
<h2>Seguimiento GPS del viaje</h2>
<p v-if="active">Captura activa cada diez minutos para {{active}}. Mantén la aplicación abierta. <button class="secondary" @click="stop">Detener captura</button></p>
<form v-if="lot?.status==='InTransit'&&!route&&canTrack" @submit.prevent="configure">
<label>Duración prevista en minutos<input v-model.number="minutes" type="number" required min="1" max="43200"></label>
<label>Corredor de referencia<textarea v-model="corridor" required rows="3" placeholder="Latitud,longitud por línea"></textarea></label><button :disabled="!online">Guardar ruta</button></form>
<button v-if="route?.active&&canTrack&&!active" @click="start">Autorizar captura GPS</button>
<template v-if="route"><button class="secondary" :disabled="!online" @click="refresh().catch(report)">Actualizar seguimiento</button>
<p>Umbral de demora {{new Date(route.deadline).toLocaleString()}}</p></template>
<ul><li v-for="a in alerts" :key="a.id||a.type">{{({Deviation:'Desvío mayor a 5 km',Reentry:'Reingreso al corredor',Delay:'Demora superior al 20 %'})[a.type]}} · {{new Date(a.occurred_at).toLocaleString()}}</li></ul><p role="status">{{message}}</p>
</section></template>
