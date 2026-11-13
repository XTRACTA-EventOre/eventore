import { test, expect } from '@playwright/test';
test('captura offline, recarga, reconexion y consulta QR', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Correo').fill('demo@example.test');
  await page.getByLabel('Contraseña').fill(process.env.BOOTSTRAP_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Registrar lote' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  });
  await context.setOffline(true);
  await page.getByLabel('Peso', { exact: true }).fill('125.50');
  await page.getByLabel('Referencia de evidencia').fill('E2E-REF');
  await page.getByLabel('Fuente declarada').fill('Mina de prueba');
  await page.getByRole('button', { name: 'Guardar captura' }).click();
  await expect(page.getByText('Pending synchronization')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pending synchronization')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Accepted by server')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Ver lote' }).click();
  const qr = page.getByAltText('Código QR para consultar este lote');
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  const id = await page.locator('.lot .identifier').textContent();
  await page.goto(`/lots/${id}`);
  await expect(page.locator('.lot .identifier')).toHaveText(id);
});
