<script setup>
import {ref,reactive,watch} from 'vue';
import {requestApi} from '../../shared/infrastructure/http/apiClient.js';
import {submitOperation,pendingOperations,retryOperation,reconcilePending} from '../../shared/infrastructure/http/pendingOperation.js';
const props=defineProps({lot:Object,identity:Object,online:Boolean}),emit=defineEmits(['refresh']);
const data=ref(null),graph=ref(null),error=ref(''),notice=ref(''),busy=ref(false),pending=ref([]);
const purity=ref(''),assayRef=ref(''),assayReason=ref(''),netWeight=ref(''),removedKind=ref('Impurities'),reason=ref(''),processRef=ref(''),loss=ref(''),reviewNote=ref('');
const reviewStatus=ref('Verified'),evidenceReason=ref(''),mode=ref('Split'),mergeIds=ref(''),transformReason=ref(''),technicalLoss=ref('0'),impurities=ref('0');
const outputs=reactive([{weight:'',weightUnit:'kg',kind:'Output',destination:''},{weight:'',weightUnit:'kg',kind:'Output',destination:''},{weight:'',weightUnit:'kg',kind:'Remainder',destination:''}]);
const can=p=>props.identity?.permissions?.includes(p),scope=()=>({tenantId:props.identity.tenantId,userId:props.identity.userId,resourceId:props.lot.lotId});
async function load(){if(!props.online)return;try{data.value=await requestApi(`/api/v1/processing/lots/${props.lot.lotId}`);reconcilePending(scope(),data.value.snapshot.facts.map(e=>e.operationId));pending.value=pendingOperations(scope());}catch(e){error.value=e.message;}}
watch(()=>[props.lot?.lotId,props.lot?.version,props.online],()=>{graph.value=null;load();},{immediate:true});
async function act(path,payload={},base='processing'){
 busy.value=true;error.value='';notice.value='';
 try{await submitOperation(base==='lots-direct'?`/api/v1/lots/${props.lot.lotId}/${path}`:`/api/v1/${base}/lots/${props.lot.lotId}/${path}`,{expectedVersion:props.lot.version,...payload},scope(),`processing:${path}`);notice.value='Operación de planta confirmada.';await load();emit('refresh');}catch(e){error.value=e.message;pending.value=pendingOperations(scope());}finally{busy.value=false;}
}
async function transform(){try{
 const ids=mode.value==='Merge'?[props.lot.lotId,...mergeIds.value.split(',').map(id=>id.trim()).filter(Boolean)]:[props.lot.lotId];
 const inputs=await Promise.all(ids.map(async lotId=>({lotId,expectedVersion:(await requestApi(`/api/v1/lots/${lotId}`)).version})));
 const selected=mode.value==='Merge'?[outputs[0]]:outputs.filter(o=>o.weight);
 await act('transformations',{inputs,plan:{mode:mode.value,outputs:selected.map(o=>({...o})),technicalLoss:{weight:technicalLoss.value,weightUnit:props.lot.weightUnit},impurities:{weight:impurities.value,weightUnit:props.lot.weightUnit},reason:transformReason.value}});
 }catch(e){error.value=e.message;}}
async function genealogy(){try{graph.value=await requestApi(`/api/v1/processing/lots/${props.lot.lotId}/genealogy`);}catch(e){error.value=e.message;}}
async function retry(attempt){busy.value=true;try{await retryOperation(attempt);await load();emit('refresh');}catch(e){error.value=e.message;}finally{busy.value=false;}}
</script>
<template>
<section class="lot-operations" aria-label="Procesamiento y genealogía"><h3>Procesamiento y genealogía</h3>
 <p v-if="error" class="alert error" role="alert">{{error}}</p><p v-if="notice" class="alert" role="status">{{notice}}</p>
 <p v-for="attempt in pending.filter(p=>p.action.startsWith('processing:'))" :key="attempt.key" class="alert">Operación sin confirmar. <button :disabled="busy||!online" @click="retry(attempt)">Reintentar operación de planta</button></p>
 <button v-if="can('processing.manage')&&lot.status==='Received'" :disabled="busy||!online" @click="act('start')">Iniciar procesamiento</button>
 <template v-if="can('processing.manage')&&lot.status==='Processing'&&data">
  <form @submit.prevent="act('assays',{purity,evidenceRef:assayRef,correctionOf:data.snapshot.latestAssay?.assayId??null,correctionReason:assayReason||null})"><h4>Análisis de pureza</h4>
   <p v-if="data.snapshot.latestAssay">Pureza vigente: {{data.snapshot.latestAssay.purity}} %. El nuevo ensayo conserva el anterior.</p>
   <label>Pureza porcentual<input v-model="purity" inputmode="decimal" required /></label><label>Evidencia de análisis<input v-model="assayRef" required /></label>
   <label v-if="data.snapshot.latestAssay">Motivo de corrección del análisis<input v-model="assayReason" required /></label><button :disabled="busy||!online">Guardar análisis</button>
  </form>
  <form @submit.prevent="act('purification',{netWeight,weightUnit:lot.weightUnit,removedKind,reason,evidenceRef:processRef})"><h4>Purificación</h4>
   <label>Peso neto ({{lot.weightUnit}})<input v-model="netWeight" inputmode="decimal" required /></label><label>Material separado<select v-model="removedKind"><option value="Impurities">Impurezas</option><option value="TechnicalLoss">Merma técnica</option></select></label>
   <label>Motivo de purificación<input v-model="reason" required /></label><label>Evidencia de purificación<input v-model="processRef" required /></label><button :disabled="busy||!online">Registrar purificación</button>
  </form>
  <form @submit.prevent="act('losses',{lossWeight:loss,weightUnit:lot.weightUnit,reason})"><h4>Merma técnica</h4><label>Cantidad de merma ({{lot.weightUnit}})<input v-model="loss" inputmode="decimal" required /></label><label>Motivo de merma<input v-model="reason" required /></label><button :disabled="busy||!online">Registrar merma</button></form>
  <details><summary>Dividir o fusionar lotes</summary><form @submit.prevent="transform">
   <label>Transformación<select v-model="mode"><option value="Split">Dividir</option><option value="Merge">Fusionar</option></select></label>
   <label v-if="mode==='Merge'">Otros lotes de entrada (IDs separados por coma)<input v-model="mergeIds" required /></label>
   <fieldset v-for="(output,index) in mode==='Merge'?[outputs[0]]:outputs" :key="index"><legend>Salida {{index+1}}</legend><label>Peso de salida<input v-model="output.weight" inputmode="decimal" :required="index<2||mode==='Merge'" /></label><label>Unidad de salida<select v-model="output.weightUnit"><option>g</option><option>kg</option><option>t</option></select></label><label>Clasificación de salida<select v-model="output.kind"><option value="Output">Producto</option><option value="Remainder">Remanente</option></select></label><label>Destino de salida<input v-model="output.destination" :required="!!output.weight" /></label></fieldset>
   <label>Merma de transformación ({{lot.weightUnit}})<input v-model="technicalLoss" required /></label><label>Impurezas de transformación ({{lot.weightUnit}})<input v-model="impurities" required /></label><label>Motivo del balance<input v-model="transformReason" required /></label><button :disabled="busy||!online">Confirmar transformación</button>
  </form></details>
  <form @submit.prevent="act('complete',{reviewNote})"><h4>Cierre de planta</h4><label>Revisión de etapas y balance<input v-model="reviewNote" required /></label><button :disabled="busy||!online">Completar procesamiento</button></form>
 </template>
 <form v-if="can('evidence.review')" @submit.prevent="act('evidence-review',{reviewStatus,reason:evidenceReason},'lots-direct')"><h4>Revisión de evidencia</h4><label>Resultado de evidencia<select v-model="reviewStatus"><option value="Verified">Aprobada</option><option value="Rejected">Rechazada</option></select></label><label>Motivo de revisión de evidencia<input v-model="evidenceReason" required /></label><button :disabled="busy||!online">Guardar revisión de evidencia</button></form>
 <button class="secondary" :disabled="!online||busy" @click="genealogy">Consultar genealogía</button>
 <div v-if="graph"><h4>Genealogía: {{graph.nodes.length}} lotes</h4><ul><li v-for="node in graph.nodes" :key="node.lotId">{{node.lotId}} · {{node.status}} · {{node.originEvidenceStatus}}</li></ul><p v-for="edge in graph.edges" :key="edge.parentId+edge.childId" class="identifier">{{edge.parentId}} → {{edge.childId}}</p></div>
 <ol v-if="data" class="history-list"><li v-for="fact in data.snapshot.facts" :key="fact.operationId"><strong>{{fact.action}}</strong><p v-if="fact.purity">Pureza {{fact.purity}} %</p><p v-if="fact.netWeight">Bruto {{fact.grossWeight}} → neto {{fact.netWeight}} {{fact.weightUnit}} · {{fact.removedKind}}</p><p v-if="fact.reason">{{fact.reason}}</p><ul v-if="fact.children"><li v-for="child in fact.children" :key="child.lotId">Nuevo lote: {{child.lotId}} · {{child.weight}} {{child.weightUnit}}</li></ul></li></ol>
</section>
</template>
