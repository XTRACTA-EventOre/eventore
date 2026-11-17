import { requestApi as request } from '../../../../shared/infrastructure/http/apiClient.js';
import { apiUrl } from '../../../../shared/infrastructure/http/apiUrl.js';
import { ref, onMounted, onUnmounted } from 'vue';
import { IndexedDbCaptureRepository } from '../../infrastructure/storage/indexeddb/IndexedDbCaptureRepository.js';
import { captureMineralLot } from '../../domain/capture/OfflineCapture.js';
import { createSynchronizationApi, SynchronizePendingCaptures, startAutoSync } from '../../application/sync-client/SynchronizePendingCaptures.js';

export function useTraceabilityWorkspace() {
  const identity=ref(null), captures=ref([]), lot=ref(null), error=ref(''), notice=ref('');
  const online=ref(navigator.onLine), busy=ref(false), qr=ref(''), sessionVerified=ref(false);
  const operations=ref(null), custody=ref(null), pendingAcceptance=ref(null);
  const can=permission=>identity.value?.permissions?.includes(permission)??false;
  const repository=new IndexedDbCaptureRepository();
  let autoSync;
  let sourceId=localStorage.getItem('eventore-source');
  if(!sourceId){sourceId=crypto.randomUUID();localStorage.setItem('eventore-source',sourceId);}
  const routeLotId=()=>/^\/lots\/([0-9a-f-]+)\/?$/i.exec(location.pathname)?.[1];
  const showError=e=>{error.value=e.message;};
  async function refreshIdentity(){
    let result;
    try{result=await request('/api/v1/auth/session');}
    catch(e){if(e.status===401){autoSync?.stop();identity.value=null;sessionVerified.value=false;captures.value=[];lot.value=null;localStorage.removeItem('eventore-last-identity');}throw e;}
    const previous=JSON.stringify(identity.value?.permissions);
    identity.value=result.identity;sessionVerified.value=true;
    localStorage.setItem('eventore-last-identity',JSON.stringify(result.identity));
    if(previous!==JSON.stringify(result.identity.permissions))connectSync();
    return result.identity;
  }
  async function refresh(){captures.value=identity.value?await repository.list({tenantId:identity.value.tenantId}):[];}
  function connectSync(){
    autoSync?.stop();if(!identity.value||!can('lots.register'))return;
    const sync=new SynchronizePendingCaptures({repository,api:createSynchronizationApi(),tenantId:identity.value.tenantId,sourceId});
    autoSync=startAutoSync({sync,onChange:()=>{void refresh().catch(showError);},onError:message=>{error.value=message;}});
  }
  async function login(email,password){
    busy.value=true;error.value='';
    try{
      const result=await request('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      identity.value=result.identity;sessionVerified.value=true;
      localStorage.setItem('eventore-last-identity',JSON.stringify(result.identity));
      await refresh();connectSync();if(routeLotId())await lookup(routeLotId());
    }catch(e){showError(e);}finally{busy.value=false;}
  }
  async function logout(){
    error.value='';
    try{
      await request('/api/v1/auth/logout',{method:'POST'});autoSync?.stop();identity.value=null;sessionVerified.value=false;captures.value=[];lot.value=null;qr.value='';operations.value=null;custody.value=null;pendingAcceptance.value=null;
      localStorage.removeItem('eventore-last-identity');notice.value='Sesión cerrada. Las capturas permanecen guardadas para su organización.';
    }catch(e){showError(e);}
  }
  async function capture(payload){
    if(!identity.value||busy.value)return false;busy.value=true;error.value='';
    try{
      if(online.value)await refreshIdentity();
      if(!can('lots.register'))throw new Error('No tienes permiso para registrar lotes');
      await captureMineralLot({repository,tenantId:identity.value.tenantId,sourceId,payload});await refresh();
      notice.value='Captura guardada en este dispositivo. Solo se marcará aceptada al recibir confirmación.';
      if(online.value)await autoSync?.run();return true;
    }catch(e){showError(e);return false;}finally{busy.value=false;}
  }
  async function synchronize(){error.value='';await autoSync?.run();await refresh().catch(showError);}
  const pendingKey=id=>`eventore-custody:${identity.value?.tenantId}:${identity.value?.userId}:${id}`;
  function readPending(id){
    try{return JSON.parse(localStorage.getItem(pendingKey(id)))??null;}catch{return null;}
  }
  async function lookup(id){
    error.value='';lot.value=null;qr.value='';operations.value=null;custody.value=null;pendingAcceptance.value=null;
    try{
      await refreshIdentity();
      lot.value=await request(`/api/v1/lots/${encodeURIComponent(id.trim())}`);
      const lotId=lot.value.lotId;
      pendingAcceptance.value=readPending(lotId);
      if(lot.value.status!=='Cancelled')qr.value=apiUrl(`/api/v1/lots/${encodeURIComponent(lotId)}/qr`);
      const [history,currentCustody]=await Promise.all([
        request(`/api/v1/lots/${lotId}/operations`),request(`/api/v1/custody/lots/${lotId}`)
      ]);
      operations.value=history;custody.value=currentCustody;
      if(currentCustody.custody?.operationId===pendingAcceptance.value?.operationId){
        localStorage.removeItem(pendingKey(lotId));pendingAcceptance.value=null;
      }
    }catch(e){showError(e);}
  }
  async function changeLot(work,message){
    if(!lot.value||busy.value||!online.value)return;
    const id=lot.value.lotId;busy.value=true;error.value='';notice.value='';
    try{await refreshIdentity();await work(id);await lookup(id);notice.value=message;}
    catch(e){await lookup(id);if(e.operationId&&custody.value?.custody?.operationId===e.operationId){error.value='';notice.value='Custodia confirmada tras recuperar la respuesta.';}else showError(e);}
    finally{busy.value=false;}
  }
  const cancelLot=reason=>changeLot(id=>request(`/api/v1/lots/${id}/cancellation`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operationId:crypto.randomUUID(),expectedVersion:lot.value.version,reason})
  }),'Lote cancelado. El motivo y el responsable quedaron en el historial.');
  const prepareHandover=recipientUserId=>changeLot(id=>request(`/api/v1/lots/${id}/handovers`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operationId:crypto.randomUUID(),expectedVersion:lot.value.version,recipientUserId})
  }),'Entrega preparada para su aceptación por un transportista autorizado.');
  const acceptCustody=handover=>changeLot(async id=>{
    const key=pendingKey(id);
    const body=readPending(id)??{operationId:crypto.randomUUID(),expectedVersion:lot.value.version,handoverId:handover?.id};
    localStorage.setItem(key,JSON.stringify(body));pendingAcceptance.value=body;
    try{await request(`/api/v1/custody/lots/${id}/accept`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      localStorage.removeItem(key);pendingAcceptance.value=null;
    }catch(e){if(e.status>=400&&e.status<500){localStorage.removeItem(key);pendingAcceptance.value=null;}else e.operationId=body.operationId;throw e;}
  },'Custodia confirmada. El lote pasó a transporte.');
  const refreshAccess=()=>{if(navigator.onLine&&identity.value)void refreshIdentity().catch(showError);};
  const connectionChanged=()=>{online.value=navigator.onLine;};
  onMounted(async()=>{
    window.addEventListener('online',connectionChanged);window.addEventListener('offline',connectionChanged);window.addEventListener('focus',refreshAccess);
    try{const result=await request('/api/v1/auth/session');identity.value=result.identity;sessionVerified.value=true;localStorage.setItem('eventore-last-identity',JSON.stringify(result.identity));}
    catch(e){
      if(e.status===401)localStorage.removeItem('eventore-last-identity');
      else{try{const saved=JSON.parse(localStorage.getItem('eventore-last-identity'));if(saved?.tenantId&&saved?.userId)identity.value=saved;}catch{}
        if(identity.value)notice.value='Sesión sin verificar: puedes capturar localmente. El servidor volverá a autorizar cada envío.';}
    }
    try{await refresh();if(identity.value){connectSync();if(online.value&&routeLotId())await lookup(routeLotId());}}catch(e){showError(e);}
  });
  onUnmounted(()=>{autoSync?.stop();repository.close();window.removeEventListener('online',connectionChanged);window.removeEventListener('offline',connectionChanged);window.removeEventListener('focus',refreshAccess);});
  return {identity,captures,lot,error,notice,online,busy,qr,sessionVerified,login,logout,capture,synchronize,lookup,can,operations,custody,pendingAcceptance,cancelLot,prepareHandover,acceptCustody,refreshIdentity};
}
