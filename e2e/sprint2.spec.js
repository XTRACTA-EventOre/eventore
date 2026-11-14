import { test, expect } from '@playwright/test';

const password = () => process.env.BOOTSTRAP_PASSWORD;
async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}
async function logout(page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
}
async function capture(page, reference) {
  const previous = await page.locator('.captures li .identifier').allTextContents();
  await page.getByLabel('Peso', { exact: true }).fill('125.50');
  await page.getByLabel('Referencia de evidencia').fill(reference);
  await page.getByLabel('Fuente declarada').fill('Mina de prueba');
  await page.getByRole('button', { name: 'Guardar captura' }).click();
  await expect.poll(async () => (await page.locator('.captures li .identifier').allTextContents()).filter(id => !previous.includes(id)).length).toBe(1);
  const captureId = (await page.locator('.captures li .identifier').allTextContents()).find(id => !previous.includes(id));
  const row = page.locator('.captures li').filter({ hasText: captureId });
  await expect(row.getByText('Accepted by server')).toBeVisible({ timeout: 20000 });
  await row.getByRole('button', { name: 'Ver lote' }).click();
  await expect(page.locator('.lot .identifier').first()).toBeVisible();
  return (await page.locator('.lot .identifier').first().textContent()).trim();
}

test('administración de roles, cancelación y aceptación de custodia desde QR', async ({ page }, testInfo) => {
  await login(page, 'admin@example.test');
  await expect(page.getByRole('heading', { name: 'Roles y permisos' })).toBeVisible();
  const user = page.getByLabel('Usuario a administrar');
  const operatorId = await user.locator('option').filter({ hasText: 'operator@example.test' }).getAttribute('value');
  await user.selectOption(operatorId);
  await page.getByRole('checkbox', { name: 'Operador', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Supervisor', exact: true }).check();
  await page.getByRole('button', { name: 'Guardar roles' }).click();
  await expect(page.getByText('Roles actualizados.', { exact: false })).toBeVisible();
  await logout(page);

  await login(page, 'operator@example.test');
  await expect(page.getByRole('heading', { name: 'Roles y permisos' })).toHaveCount(0);
  const cancelledId = await capture(page, 'S2-CANCEL');
  await page.getByLabel('Motivo de cancelación').fill('Registro de prueba duplicado');
  await page.getByRole('button', { name: 'Cancelar lote', exact: true }).click();
  await expect(page.getByText('Lote cancelado. No habilitado para transporte.')).toBeVisible();
  await expect(page.getByText('Motivo: Registro de prueba duplicado')).toBeVisible();
  await expect(page.getByAltText('Código QR para consultar este lote')).toHaveCount(0);

  const lotId = await capture(page, 'S2-HANDOVER');
  await page.getByRole('button', { name: 'Preparar entrega', exact: true }).click();
  await expect(page.getByText('Entrega preparada', { exact: true })).toBeVisible();
  await logout(page);

  await login(page, 'carrier@example.test');
  await expect(page.getByRole('heading', { name: 'Registrar lote' })).toHaveCount(0);
  // This is the deep link encoded by the QR; no simulated camera scan is claimed.
  await page.goto(`/lots/${lotId}`);
  await expect(page.getByRole('button', { name: 'Aceptar custodia', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar custodia', exact: true }).click();
  await expect(page.getByText('Custodia confirmada. El lote está en transporte.')).toBeVisible();
  await expect(page.locator('.lot dd').filter({ hasText: /^InTransit$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar lote', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Custodia confirmada. El lote está en transporte.')).toBeVisible();
  await expect(page.getByText('Custodia aceptada', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('custody-confirmed.png'), fullPage: true });
  await page.goto(`/lots/${cancelledId}`);
  await expect(page.getByRole('button', { name: 'Aceptar custodia', exact: true })).toHaveCount(0);
});

test('respuesta perdida de aceptación se recupera sin duplicar la custodia', async ({ page }, testInfo) => {
  await login(page, 'admin@example.test');
  const registered = await page.request.post('/api/v1/lots', { data: { clientEventId: crypto.randomUUID(), mineralType: 'Gold', weight: '25.5', weightUnit: 'kg', originEvidence: { reference: 'S2-RECOVERY', source: 'Mina de prueba' } } });
  expect(registered.status()).toBe(201);
  const lot = await registered.json();
  expect((await page.request.post(`/api/v1/lots/${lot.lotId}/handovers`, { data: { operationId: crypto.randomUUID(), expectedVersion: 1, recipientUserId: null } })).status()).toBe(201);
  await logout(page); await login(page, 'carrier@example.test');
  await page.goto(`/lots/${lot.lotId}`);
  let lost = false;
  await page.route('**/api/v1/custody/lots/*/accept', async route => {
    if (lost) return route.continue();
    const response = await route.fetch(); expect(response.status()).toBe(200);
    lost = true; await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Aceptar custodia', exact: true }).click();
  await expect(page.getByText('Custodia confirmada tras recuperar la respuesta.')).toBeVisible();
  await expect(page.getByText('Custodia aceptada', { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('Custodia aceptada', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('custody-recovered.png'), fullPage: true });
});
