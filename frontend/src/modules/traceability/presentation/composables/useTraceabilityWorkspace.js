import { ref, onMounted, onUnmounted } from 'vue';
import { IndexedDbCaptureRepository } from '../../infrastructure/storage/indexeddb/IndexedDbCaptureRepository.js';
import { captureMineralLot } from '../../domain/capture/OfflineCapture.js';
import { createSynchronizationApi, SynchronizePendingCaptures, startAutoSync } from '../../application/sync-client/SynchronizePendingCaptures.js';

export function useTraceabilityWorkspace() {
  const identity=ref(null), captures=ref([]), lot=ref(null), error=ref(''), notice=ref('');
  const online=ref(navigator.onLine), busy=ref(false), qr=ref(''), sessionVerified=ref(false);
  const repository=new IndexedDbCaptureRepository();
  let autoSync;
  let sourceId=localStorage.getItem('eventore-source');
  if(!sourceId){sourceId=crypto.randomUUID();localStorage.setItem('eventore-source',sourceId);}
  const routeLotId=()=>/^\/lots\/([0-9a-f-]+)\/?$/i.exec(location.pathname)?.[1];
  const showError=e=>{error.value=e.message;};
  async function request(url,options){
    const response=await fetch(url,{credentials:'same-origin',...options});
    const body=response.status===204?null:await response.json();
    if(!response.ok){const failure=new Error(body?.error?.message??'No se pudo completar la operación');failure.status=response.status;throw failure;}
    return body;
  }
  async function refresh(){captures.value=identity.value?await repository.list({tenantId:identity.value.tenantId}):[];}
  function connectSync(){
    autoSync?.stop();if(!identity.value)return;
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
      await request('/api/v1/auth/logout',{method:'POST'});autoSync?.stop();identity.value=null;sessionVerified.value=false;captures.value=[];lot.value=null;qr.value='';
      localStorage.removeItem('eventore-last-identity');notice.value='Sesión cerrada. Las capturas permanecen guardadas para su organización.';
    }catch(e){showError(e);}
  }
  async function capture(payload){
    if(!identity.value||busy.value)return false;busy.value=true;error.value='';
    try{
      await captureMineralLot({repository,tenantId:identity.value.tenantId,sourceId,payload});await refresh();
      notice.value='Captura guardada en este dispositivo. Solo se marcará aceptada al recibir confirmación.';
      if(online.value)await autoSync?.run();return true;
    }catch(e){showError(e);return false;}finally{busy.value=false;}
  }
  async function synchronize(){error.value='';await autoSync?.run();await refresh().catch(showError);}
  async function lookup(id){
    error.value='';lot.value=null;qr.value='';
    try{lot.value=await request(`/api/v1/lots/${encodeURIComponent(id.trim())}`);if(lot.value.status!=='Cancelled')qr.value=`/api/v1/lots/${encodeURIComponent(lot.value.lotId)}/qr`;}catch(e){showError(e);}
  }
  const connectionChanged=()=>{online.value=navigator.onLine;};
  onMounted(async()=>{
    window.addEventListener('online',connectionChanged);window.addEventListener('offline',connectionChanged);
    try{const result=await request('/api/v1/auth/session');identity.value=result.identity;sessionVerified.value=true;localStorage.setItem('eventore-last-identity',JSON.stringify(result.identity));}
    catch(e){
      if(e.status===401)localStorage.removeItem('eventore-last-identity');
      else{try{const saved=JSON.parse(localStorage.getItem('eventore-last-identity'));if(saved?.tenantId&&saved?.userId)identity.value=saved;}catch{}
        if(identity.value)notice.value='Sesión sin verificar: puedes capturar localmente. El servidor volverá a autorizar cada envío.';}
    }
    try{await refresh();if(identity.value){connectSync();if(online.value&&routeLotId())await lookup(routeLotId());}}catch(e){showError(e);}
  });
  onUnmounted(()=>{autoSync?.stop();repository.close();window.removeEventListener('online',connectionChanged);window.removeEventListener('offline',connectionChanged);});
  return {identity,captures,lot,error,notice,online,busy,qr,sessionVerified,login,logout,capture,synchronize,lookup};
}
