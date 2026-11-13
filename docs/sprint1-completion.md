# Aceptación frontend del Sprint 1

Alcance conservado: US12 (registro), US14 (captura persistente), US15 (sincronización),
US16 (idempotencia/conflicto) y US17 (consulta QR).

Consultar el [README](../README.md) para instalación, demo offline y comandos. El
backend y las migraciones se ejecutan en
[eventore-platform](https://github.com/XTRACTA-EventOre/eventore-platform).

El navegador conserva pendientes en IndexedDB con sus UUID originales. Nunca borra
capturas ni las marca aceptadas hasta confirmar la respuesta individual del servidor.
No borrar los datos del navegador con capturas pendientes. Cerrar sesión no elimina
datos locales; en equipos compartidos permanecen en el perfil del navegador.

La primera carga y primer login requieren conexión. Tras cargar build/preview,
el app shell permite recargar sin red. La identidad local permite capturar; cada
sincronización vuelve a autorizarse en el backend. El tenant procede de la sesión.

`npm test` comprueba almacenamiento, reintentos y estados. `npm run test:e2e` usa
Chromium y una plataforma provisionada por separado. El workflow de este repositorio
inicia dos bases, servicios y gateway desde una revisión fija de la plataforma y
conserva trazas de fallos. La regresión Jest/PostgreSQL y el smoke HTTP viven allí.

Demostración: login, desconectar, capturar, recargar, observar Pending, reconectar,
observar Accepted, Ver lote y QR. El QR identifica un registro; no verifica autenticidad
física ni origen ético. Roles, custodia, incidentes y el resto de Avance 4 requieren
implementación y evidencias propias.
