<script setup>
import {ref,reactive} from 'vue';
import {requestApi} from '../../../shared/infrastructure/http/apiClient.js';
const open=ref(false);
const action=ref('register'),message=ref(''),busy=ref(false);
const form=reactive({email:'',password:'',code:'',requestId:'',companyName:'',companyId:'',evidence:''});
async function submit(){
  busy.value=true;
  try{
    const result=await requestApi('/api/v1/auth/'+action.value,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    form.password='';form.code='';
    if(result.requestId)form.requestId=result.requestId;
    message.value=action.value==='registration-status'?({Pending:'Pendiente de revisión',Approved:'Empresa aprobada. Ya puedes iniciar sesión.',Rejected:'Solicitud rechazada. Contacta al responsable de revisión.'})[result.status]:result.message??('Solicitud pendiente de validación. Guarda tu referencia '+result.requestId);
    if(action.value==='recovery')action.value='reset';
  }catch(error){message.value=error.message;}finally{busy.value=false;}
}
</script>
<template><details class="panel" @toggle="open=$event.currentTarget.open"><summary>Registro de empresa y recuperación de acceso</summary>
<form v-if="open" @submit.prevent="submit"><label>Trámite<select v-model="action"><option value="register">Registrar empresa</option><option value="registration-status">Consultar solicitud</option><option value="recovery">Solicitar recuperación</option><option value="reset">Usar código de recuperación</option></select></label>
<label>Correo corporativo<input v-model="form.email" type="email" required></label>
<template v-if="action==='register'"><label>RUC<input v-model="form.companyId" pattern="[0-9]{11}" required></label><label>Razón social<input v-model="form.companyName" required></label><label>Referencia de evidencia empresarial<input v-model="form.evidence" required></label></template>
<label v-if="action==='reset'">Código recibido<input v-model="form.code" required></label>
<label v-if="action==='registration-status'">Referencia de solicitud<input v-model="form.requestId" required></label>
<label v-if="action==='register'||action==='reset'">Nueva contraseña<input v-model="form.password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
<button :disabled="busy">Enviar</button></form><p role="status">{{message}}</p></details></template>
