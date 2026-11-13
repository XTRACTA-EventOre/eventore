# EventOre — Frontend

Aplicación Vue/Vite de trazabilidad mineral del equipo XTRACTA. Incluye captura
offline con IndexedDB, sincronización, sesiones y consulta QR. El remoto y el historial
del repositorio se conservan. APIs, servicios, SQL, Docker/Compose y pruebas backend
se mantienen en [eventore-platform](https://github.com/XTRACTA-EventOre/eventore-platform).

## Desarrollo independiente

Requisito: Node.js 24.

```sh
git clone https://github.com/XTRACTA-EventOre/eventore.git
cd eventore
git switch develop
# Mientras el PR de separación esté abierto:
# git switch feature/separate-frontend
npm ci --ignore-scripts
cp .env.example .env
npm run dev
```

En PowerShell usar `Copy-Item .env.example .env`. Abrir `http://localhost:5173`.
La compilación y las pruebas unitarias funcionan sin instalar el backend.
Para operaciones conectadas, arrancar Compose en el otro repositorio según su
[README](https://github.com/XTRACTA-EventOre/eventore-platform/blob/feature/mysql-database/README.md)
y crear una cuenta en Identity. El gateway escucha en 3000.

| Variable | Ejemplo | Uso |
| --- | --- | --- |
| VITE_API_BASE_URL | `/api` | Prefijo público usado por sesión, salud, sincronización y QR |
| API_PROXY_TARGET | `http://localhost:3000` | Destino del proxy `/api` de Vite dev y preview |
| APP_BASE_URL (en plataforma) | `http://localhost:5173` | Origen exacto del frontend para CORS, escrituras y enlaces QR |

`VITE_*` se incluye en JavaScript público durante el build: no poner secretos ahí.
Se recomienda conservar `/api` y publicar SPA y gateway bajo el mismo origen.
Para una API absoluta del mismo sitio se admite `VITE_API_BASE_URL=http://localhost:3000/api`;
el gateway permite credenciales solo desde APP_BASE_URL. Las cookies son HttpOnly y
SameSite=Strict: dominios de sitios diferentes requieren otro diseño de cookies/CSRF.
Usar siempre el mismo hostname (`localhost` en ambos procesos locales).

## Compilación, offline y pruebas

```sh
npm test
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Para demo offline configurar `APP_BASE_URL=http://localhost:4173` en la plataforma,
recrear sus servicios y abrir `http://localhost:4173`. El service worker funciona en
build/preview; la primera carga y el primer inicio de sesión requieren conexión.
El frontend sirve también `/lots/:id`, la ruta codificada en los QR. En alojamiento
estático configurar fallback a `index.html` y proxy `/api` al gateway; usar HTTPS,
NODE_ENV=production en Identity y Cache-Control: no-cache para index.html y sw.js.

Para aceptación real de navegador arrancar la plataforma con APP_BASE_URL en 4173,
crear `demo@example.test` para el tenant `11111111-1111-4111-8111-111111111111`, definir
BOOTSTRAP_PASSWORD temporalmente en el terminal de Playwright y ejecutar:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright arranca únicamente el preview frontend; la plataforma se inicia aparte.
CI comprueba primero unidad/build sin backend y en otro job obtiene una revisión fija
de eventore-platform para verificar en Chromium la captura offline, recarga,
reconexión y consulta QR. No se copian fuentes backend al producto frontend.

## Colaboración y alcance

Trabajar en `feature/*` desde `develop` y abrir PR hacia `develop`. `main` y las ramas
históricas permanecen intactas. Integrar primero el
[PR backend MySQL #2](https://github.com/XTRACTA-EventOre/eventore-platform/pull/2).
[Separación e historial](docs/repository-split.md),
[aceptación Sprint 1](docs/sprint1-completion.md),
[contrato API](https://github.com/XTRACTA-EventOre/eventore-platform/blob/feature/mysql-database/docs/contracts/sprint1-api.md).
Esta reorganización es previa al trabajo funcional e informe hasta Avance 4.

## Base de datos MySQL

La plataforma usa MySQL 8.4 con bases y usuarios separados para Identity y Traceability.
Vue sigue comunicándose solo por HTTP con el Gateway; no contiene credenciales SQL.
El workflow de navegador fija una revisión MySQL del PR #2. La captura local valida
el rango de peso admitido por la API (35 dígitos enteros y 30 decimales), conservando
el valor como texto exacto. Las capturas anteriores permanecen guardadas.
Consultar [configuración MySQL y datos anteriores](https://github.com/XTRACTA-EventOre/eventore-platform/blob/feature/mysql-database/docs/mysql.md).
