import{test,expect,vi,beforeEach}from'vitest';
import{submitOperation,pendingOperations,retryOperation}from'../../src/shared/infrastructure/http/pendingOperation.js';
let saved;
beforeEach(()=>{saved=new Map();vi.stubGlobal('localStorage',{get length(){return saved.size;},key:i=>[...saved.keys()][i],getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)});});
test('a lost response preserves original method, body and operation ID across retries and isolates users',async()=>{
 const scope={tenantId:'tenant-A',userId:'user-A',resourceId:'product-A'};let committed;
 vi.stubGlobal('fetch',vi.fn(async(_path,options)=>{committed=options;throw Error('response lost');}));
 await expect(submitOperation('/api/v1/jewelry/products/id/composition',{expectedVersion:1,reason:'Original'},scope,'composition','PUT')).rejects.toThrow('response lost');
 const pending=pendingOperations(scope);expect(pending).toHaveLength(1);expect(pendingOperations({...scope,userId:'user-B'})).toHaveLength(0);
 vi.stubGlobal('fetch',vi.fn(async(_path,options)=>{expect(options.method).toBe(committed.method);expect(options.body).toBe(committed.body);return {ok:true,status:200,json:async()=>({version:2})};}));
 await retryOperation(pending[0]);expect(pendingOperations(scope)).toHaveLength(0);
});
