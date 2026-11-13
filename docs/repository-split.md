# Separación del frontend — 13 de noviembre de 2026 (Lima)

El backend se publicó y se verificó en
[eventore-platform](https://github.com/XTRACTA-EventOre/eventore-platform) antes de
retirar su copia de esta rama. El [PR backend #1](https://github.com/XTRACTA-EventOre/eventore-platform/pull/1)
prepara ejecución independiente. Integrarlo antes del PR frontend.

Se conserva el nombre eventore, su remoto y los commits originales; frontend/ se
mueve a la raíz mediante un commit normal, sin reescribir historia. Las 23 ramas de
origen, incluidas main, develop y feature/microservices-avance3, permanecen intactas
hasta revisión de los PRs. Las ramas históricas reflejan la estructura antigua.
Antes de empezar se creó y verificó un bundle completo local.

La plataforma conserva el historial extraído de backend/, docs, CI y Compose,
con autores y fechas. Sus SHA cambian al filtrar rutas. Allí se publica el
[mapa de ramas y commits](https://github.com/XTRACTA-EventOre/eventore-platform/tree/feature/independent-backend/docs/migration).
Se verificaron 919 blobs backend a través de las 23 ramas. Gitleaks 8.30.1 no detectó
secretos en todos los refs originales. No se migran bases existentes, secretos de
GitHub, despliegues ni permisos de equipos, y no se hace push a main.

La propiedad del backend, SQL, Gateway, Compose, OpenAPI y documentación de servicios
corresponde a la plataforma. Aquí permanecen Vue/Vite, la especificación funcional de
captura offline, pruebas frontend y su guía. No había imports de código entre paquetes;
se retiraron las dependencias de Docker, servidores estáticos y Playwright respecto al
árbol monorepo. La comunicación se realiza por HTTP con prefijos /api/v1 conservados.

La [guía de plataforma](https://github.com/XTRACTA-EventOre/eventore-platform/blob/feature/independent-backend/docs/repository-split.md)
documenta CORS, cookies, migración e integración. El workflow frontend obtiene una
revisión backend inmutable para la aceptación, y se actualiza mediante PR cuando cambia
el contrato. La unidad/build del frontend no necesitan ese checkout. La fuente de
verdad de API es el OpenAPI de la plataforma. No se afirma que esta separación complete
las historias de los Avances 3/4; los resultados de CI de estos PRs son evidencia de
regresión y separación, no del producto completo.

## Cambio posterior a MySQL

El [PR backend #2](https://github.com/XTRACTA-EventOre/eventore-platform/pull/2) sustituye
PostgreSQL por MySQL 8.4 en la plataforma. El workflow frontend obtiene una revisión
inmutable de ese PR y comprueba la misma API con MySQL. Integrar el backend #2 antes
de este PR frontend. Los enlaces a #1 y al mapa de extracción anterior se conservan
como evidencia histórica. No se ejecuta una conversión de datos existentes.
