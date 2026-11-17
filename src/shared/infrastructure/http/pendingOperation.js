import { requestApi } from './apiClient.js';
const prefix = scope => `eventore-command:${scope.tenantId}:${scope.userId}:${scope.resourceId}:`;
export function pendingOperations(scope) {
  const result = [];
  for (let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i);
    if (key?.startsWith(prefix(scope))) {
      try { const value=JSON.parse(localStorage.getItem(key)); if(value?.path&&value?.body?.operationId)result.push({key,...value}); } catch {}
    }
  }
  return result;
}
export async function submitOperation(path, payload, scope, action, method='POST') {
  const key=prefix(scope)+action;
  let attempt;
  try { attempt=JSON.parse(localStorage.getItem(key)); } catch {}
  attempt??={path,action,method,body:{operationId:crypto.randomUUID(),...payload}};
  localStorage.setItem(key,JSON.stringify(attempt));
  try {
    const result=await requestApi(attempt.path,{method:attempt.method??'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.body)});
    localStorage.removeItem(key);return result;
  } catch(error) {
    if(error.status>=400&&error.status<500)localStorage.removeItem(key);
    throw error;
  }
}
export async function retryOperation(attempt) {
  try {
    const result=await requestApi(attempt.path,{method:attempt.method??'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.body)});
    localStorage.removeItem(attempt.key);return result;
  } catch(error) {
    if(error.status>=400&&error.status<500)localStorage.removeItem(attempt.key);
    throw error;
  }
}
export function reconcilePending(scope, confirmedIds) {
  for(const attempt of pendingOperations(scope))if(confirmedIds.includes(attempt.body.operationId))localStorage.removeItem(attempt.key);
}
