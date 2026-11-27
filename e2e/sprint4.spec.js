import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

test('la organización solicita un plan y rota una clave ERP',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Correo',{exact:true}).fill('admin@example.test');
 await page.getByLabel('Contraseña',{exact:true}).fill(process.env.BOOTSTRAP_PASSWORD);
 await page.getByRole('button',{name:'Iniciar sesión'}).click();
 await page.getByRole('button',{name:'Organización',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Plan Base'})).toBeVisible();
 await page.getByRole('button',{name:'Solicitar plan Pro',exact:false}).click();
 await expect(page.getByRole('status').filter({hasText:'Orden de pago pendiente'})).toBeVisible();
 await page.getByRole('button',{name:'Generar clave ERP'}).click();
 const value=page.locator('section').getByText('Clave de uso privado').locator('code');
 const original=await value.textContent();
 await page.getByRole('button',{name:'Rotar clave'}).first().click();
 await expect(value).not.toHaveText(original);
});

test('captura un punto GPS sin red y lo sincroniza al reconectar',async({page,context})=>{
 const password=process.env.BOOTSTRAP_PASSWORD;
 const post=async(path,body)=>{
  const r=await page.request.post('/api/v1/'+path,{data:body});
  expect(r.ok(),path+' '+r.status()).toBeTruthy();
  return r.json();
 };
 await post('auth/login',{email:'admin@example.test',password});
 const {lotId}=await post('lots',{clientEventId:randomUUID(),mineralType:'Gold',weight:'5',weightUnit:'kg',originEvidence:{reference:'GPS',source:'Demo'}});
 const delivery=await post('lots/'+lotId+'/handovers',{operationId:randomUUID(),expectedVersion:1,recipientUserId:null});
 await post('auth/login',{email:'carrier@example.test',password});
 await post('custody/lots/'+lotId+'/accept',{operationId:randomUUID(),expectedVersion:delivery.version,handoverId:delivery.handoverId});
 await context.grantPermissions(['geolocation']);
 await page.goto('/lots/'+lotId);
 await page.getByLabel('Corredor de referencia').fill('0,0\n0,1');
 await page.getByRole('button',{name:'Guardar ruta'}).click();
 const start=page.getByRole('button',{name:'Autorizar captura GPS'});
 await expect(start).toBeVisible();
 await context.setOffline(true);
 await expect(page.getByText('Sin conexión',{exact:true})).toBeVisible();
 await context.setGeolocation({latitude:0.1,longitude:0.5});
 await start.click();
 await expect(page.getByText('Punto guardado en este dispositivo.')).toBeVisible();
 const sent=page.waitForResponse(r=>r.url().endsWith('/positions')&&r.request().method()==='POST');
 await context.setOffline(false);
 const response=await sent;
 expect(response.status(),await response.text()).toBe(200);
 await expect(page.getByText('Desvío mayor a 5 km',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Detener captura'}).click();
 await expect(start).toBeVisible();
});
