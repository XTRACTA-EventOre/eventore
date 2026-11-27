import{test,expect}from'@playwright/test';
test('Swagger local ejecuta una consulta protegida documentada',async({page},testInfo)=>{
 await page.goto('/');await page.getByLabel('Correo').fill('admin@example.test');await page.getByLabel('Contraseña').fill(process.env.BOOTSTRAP_PASSWORD);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
 await page.goto('/api/docs');await expect(page.getByRole('heading',{name:/EventOre Platform Avance 4/})).toContainText('EventOre Platform Avance 4');
 const operation=page.locator('.opblock').filter({has:page.locator('[data-path="/reporting/dashboard"]')});await operation.locator('.opblock-summary').click();await operation.getByRole('button',{name:'Try it out'}).click();await operation.getByRole('button',{name:'Execute',exact:true}).click();await expect(operation.locator('.live-responses-table .response-col_status:not(.col_header)')).toHaveText('200');await operation.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('swagger-dashboard-200.png')});
});
