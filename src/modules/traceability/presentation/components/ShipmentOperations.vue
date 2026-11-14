<script setup>
import { ref, watch, computed } from 'vue';
import { requestApi } from '../../../../shared/infrastructure/http/apiClient.js';
import { apiUrl } from '../../../../shared/infrastructure/http/apiUrl.js';
import { pendingOperations, submitOperation, retryOperation, reconcilePending } from '../../../../shared/infrastructure/http/pendingOperation.js';
const props=defineProps({lot:Object,identity:Object,online:Boolean});
const emit=defineEmits(['refresh']);
const data=ref(null),busy=ref(false),error=ref(''),notice=ref(''),pending=ref([]),transporters=ref([]);
const weight=ref(''),unit=ref('kg'),location=ref(''),description=ref(''),blocking=ref(true),files=ref([]),recipient=ref('');
const receiveQuarantine=ref(false),receiveReason=ref(''),reviewReasons=ref({}),reviewDecisions=ref({});
const can=p=>props.identity?.permissions?.includes(p);
const isCustodian=computed(()=>data.value?.snapshot.custodianUserId===props.identity?.userId);
const scope=()=>({tenantId:props.identity.tenantId,userId:props.identity.userId,resourceId:props.lot.lotId});
const labels={CheckpointRecorded:'Checkpoint',IncidentReported:'Incidente',DelegationProposed:'Relevo propuesto',DelegationAccepted:'Relevo aceptado',PlantReceived:'Recepción en planta',RestrictionReviewed:'Revisión de restricción'};
async function load(){
  if(!props.online||!props.lot)return;
  try{
    data.value=await requestApi(`/api/v1/shipments/lots/${props.lot.lotId}`);
    reconcilePending(scope(),data.value.snapshot.history.map(event=>event.operationId));
    pending.value=pendingOperations(scope());
    for(const restriction of data.value.snapshot.restrictions)reviewDecisions.value[restriction.id]??='Maintain';
    if(can('shipments.delegate'))transporters.value=(await requestApi('/api/v1/auth/transporters')).users.filter(user=>user.id!==props.identity.userId);
  }catch(e){error.value=e.message;}
}
watch(()=>[props.lot?.lotId,props.lot?.version,props.online],load,{immediate:true});
async function act(action,path,payload){
  busy.value=true;error.value='';notice.value='';
  try{await submitOperation(`/api/v1/shipments/lots/${props.lot.lotId}/${path}`,{expectedVersion:props.lot.version,...payload},scope(),action);
    notice.value='Operación confirmada y registrada en el historial.';emit('refresh');}
  catch(e){error.value=e.message;pending.value=pendingOperations(scope());}
  finally{busy.value=false;}
}
async function incident(){
  busy.value=true;error.value='';
  try{
    if(!files.value.length||files.value.length>4)throw new Error('Adjunta entre una y cuatro fotografías');
    const ids=[];
    for(const file of files.value){
      if(file.size>5*1024*1024||!['image/jpeg','image/png'].includes(file.type))throw new Error('Cada fotografía debe ser JPG o PNG y de hasta 5 MB');
      const photo=await requestApi(`/api/v1/shipments/lots/${props.lot.lotId}/evidence`,{method:'POST',headers:{'Content-Type':file.type},body:file});ids.push(photo.id);
    }
    await act('IncidentReported','incidents',{description:description.value,severity:blocking.value?'Blocking':'Information',photoIds:ids});
  }catch(e){error.value=e.message;}
  finally{busy.value=false;}
}
async function retry(attempt){busy.value=true;error.value='';try{await retryOperation(attempt);emit('refresh');}catch(e){error.value=e.message;}finally{pending.value=pendingOperations(scope());busy.value=false;}}
</script>

<template>
  <section class="lot-operations" aria-label="Transporte y recepción">
    <h3>Transporte y recepción</h3>
    <p v-if="error" class="alert error" role="alert">{{error}}</p><p v-if="notice" class="alert" role="status">{{notice}}</p>
    <p v-for="attempt in pending.filter(p=>Object.hasOwn(labels,p.action))" :key="attempt.key" class="alert">{{labels[attempt.action]??attempt.action}} sin confirmar. El reintento conserva los datos originales.
      <button type="button" :disabled="busy||!online" @click="retry(attempt)">Reintentar confirmación</button>
    </p>
    <template v-if="data">
      <form v-if="lot.status==='InTransit'&&can('shipments.checkpoint')&&(isCustodian||can('shipments.weigh'))" @submit.prevent="act('CheckpointRecorded','checkpoints',{weight,weightUnit:unit,location})">
        <h4>Registrar checkpoint</h4><label>Nombre del checkpoint<input v-model="location" required maxlength="200" /></label>
        <div class="formrow"><label>Peso medido<input v-model="weight" inputmode="decimal" required /></label><label>Unidad del checkpoint<select v-model="unit"><option>g</option><option>kg</option><option>t</option></select></label></div>
        <button :disabled="busy||!online">Guardar checkpoint</button>
      </form>
      <form v-if="lot.status==='InTransit'&&can('shipments.report')&&(isCustodian||can('shipments.supervise'))" @submit.prevent="incident">
        <h4>Reportar incidente</h4><label>Descripción del incidente<input v-model="description" required maxlength="1000" /></label>
        <label>Fotografías del incidente<input type="file" accept="image/jpeg,image/png" multiple required @change="files=Array.from($event.target.files)" /></label>
        <label class="checkbox-label"><input v-model="blocking" type="checkbox" /> El incidente compromete el lote y requiere cuarentena</label>
        <button :disabled="busy||!online">Registrar incidente</button>
      </form>
      <form v-if="lot.status==='InTransit'&&can('shipments.delegate')&&isCustodian" @submit.prevent="act('DelegationProposed','delegations',{recipientUserId:recipient})">
        <h4>Proponer relevo de custodia</h4><label>Transportista que recibe<select v-model="recipient" required><option value="">Selecciona un transportista</option><option v-for="user in transporters" :key="user.id" :value="user.id">{{user.email}}</option></select></label>
        <p class="muted">Conservarás la custodia hasta que el destinatario acepte.</p><button :disabled="busy||!online||!!data.snapshot.restrictions.length">Proponer relevo</button>
      </form>
      <template v-for="proposal in data.snapshot.delegations" :key="proposal.id">
        <button v-if="can('custody.accept')&&proposal.recipientId===identity.userId" :disabled="busy||!online" @click="act('DelegationAccepted','delegation-acceptance',{delegationId:proposal.id})">Aceptar relevo de custodia</button>
      </template>
      <form v-if="lot.status==='InTransit'&&can('shipments.receive')" @submit.prevent="act('PlantReceived','receipt',{quarantineDecision:receiveQuarantine?'ReceiveUnderQuarantine':null,reviewReason:receiveReason||null})">
        <h4>Recepción en planta</h4>
        <template v-if="data.snapshot.restrictions.length"><label class="checkbox-label"><input v-model="receiveQuarantine" type="checkbox" required /> Autorizar recepción física bajo cuarentena</label>
          <label>Motivo de recepción bajo cuarentena<input v-model="receiveReason" required maxlength="1000" /></label><p class="muted">La recepción no elimina las restricciones.</p></template>
        <button :disabled="busy||!online">Confirmar recepción en planta</button>
      </form>
      <form v-for="restriction in can('shipments.review')?data.snapshot.restrictions:[]" :key="restriction.id" @submit.prevent="act('RestrictionReviewed','restriction-review',{restrictionId:restriction.id,decision:reviewDecisions[restriction.id]??'Maintain',reason:reviewReasons[restriction.id]})">
        <h4>Revisar restricción</h4><p>{{restriction.reason}}</p><label>Decisión de revisión<select v-model="reviewDecisions[restriction.id]"><option value="Maintain">Mantener restricción</option><option value="Release">Liberar restricción</option></select></label>
        <label>Motivo de revisión<input v-model="reviewReasons[restriction.id]" required maxlength="1000" /></label><button :disabled="busy||!online">Registrar revisión</button>
      </form>
      <ol class="history-list"><li v-for="event in data.events" :key="event.operationId"><strong>{{labels[event.action]??event.action}}</strong><p>{{new Date(event.occurredAt).toLocaleString('es-PE')}}</p>
        <p v-if="event.comparison">Diferencia: {{event.comparison.lossPercentage}} % · {{event.comparison.critical?'Requiere revisión':'Dentro de tolerancia'}}. {{event.comparison.interpretation}}</p>
        <p v-if="event.description">{{event.description}}</p><p v-if="event.reviewReason">Decisión: {{event.reviewReason}}</p><p v-if="event.reason">Motivo: {{event.reason}}</p>
        <div class="evidence-grid"><img v-for="photo in data.photos.filter(photo=>photo.incidentId===event.operationId)" :key="photo.id" :src="apiUrl(`/api/v1/shipments/evidence/${photo.id}`)" alt="Evidencia fotográfica del incidente" loading="lazy" /></div>
      </li></ol>
    </template>
  </section>
</template>
