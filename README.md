# InmoFlow — gestión de alquileres

App web (PWA instalable) para administrar los alquileres propios y en copropiedad.
Mismo esquema que OBRICK: un único `index.html`, datos en Firestore (proyecto `costo-de-obras`)
y archivos en Google Drive (carpeta **InmoFlow**). Sin conexión funciona igual y sincroniza después.

## Qué hace
- **Inmuebles**: titularidad por socio (ej. Patricio 50% / Benjamín 50%), N° de Rentas, cuenta municipal, EPEC, agua, gas, catastro, matrícula, con links para consultar.
- **Costo e inversión**: partidas en pesos, dólar oficial o blue; se convierten con la cotización histórica de su fecha.
- **Contratos** (la carpeta de cada alquiler): locatario, garantes, plazo, índice (ICL, IPC, UVA, % fijo, Casa Propia/manual), período de ajuste, vencimiento, punitorios, comisión, depósito.
- **Ajustes automáticos**: calcula el nuevo monto con el ICL del BCRA o el IPC del INDEC, avisa 30 días antes (panel + notificación) y prepara el mensaje al locatario.
- **Cobros**: sugiere período y monto, calcula punitorios, comisión, neto y su valor en US$ oficial y blue del día. Emite **recibo PDF** (original y duplicado, monto en letras) y lo comparte.
- **Cuenta corriente** por contrato: debe / pagado / saldo, mes a mes.
- **Gastos** por inmueble (arreglos, pintura, electricidad, impuestos…), con comprobante; los que paga la administración se descuentan en la liquidación; las mejoras suman al costo.
- **Liquidación mensual** por socio igual a la planilla: bruto → comisión → gastos → neto. PDF y texto para WhatsApp.
- **Rentabilidad**: rentabilidad anual en dólares, % recuperado, años de amortización y cuánto falta, por inmueble y de toda la cartera. Selector “Vista” para ver todo como total o como la parte de cada socio.
- **Avisos**: WhatsApp / email a locatarios y garantes con plantillas (recordatorio, ajuste, deuda, aviso al garante, vencimiento) y envío por grupos.
- **Documentos y fotos** por inmueble, contrato y gasto.
- Importa la planilla mensual de Google Sheets (.xlsx), backup JSON y exportación a Excel.

## Fuentes de datos (públicas, sin clave)
- Dólar oficial y blue histórico: `api.argentinadatos.com/v1/cotizaciones/dolares/{oficial|blue}` (+ DolarApi para el día).
- ICL: API del BCRA v4, variable 40 (`api.bcra.gob.ar/estadisticas/v4.0/monetarias/40`, máximo `limit=3000`).
- IPC: `api.argentinadatos.com/v1/finanzas/indices/inflacion`. UVA: `.../indices/uva`.

## Desarrollo
- El código está en `src/`. `bash build.sh` arma `index.html` y `version.json`.
- Para publicar una versión nueva: subir `APP_VERSION` en `src/10-core.js`, correr `build.sh` y subir
  `index.html`, `version.json`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`.
- Prueba local: `serve.ps1` (http://localhost:8778). En localhost no anda el login de Google (el
  cliente OAuth sólo autoriza `patriciocuffia-afk.github.io`); los datos quedan en el navegador.

## Publicar en GitHub Pages
Crear el repo `patriciocuffia-afk/inmoflow`, subir los archivos de arriba y activar Pages.
Queda en `https://patriciocuffia-afk.github.io/inmoflow/` — mismo origen que OBRICK, así que el
login de Google funciona sin tocar la consola.

## Acceso de la secretaria
Google Cloud → proyecto `costo-de-obras` → IAM → Agregar su cuenta con el rol
**Usuario de Cloud Datastore**. Ella entra con su Google y ve los mismos datos.
Los archivos de Drive quedan en la cuenta de quien los sube (compartí la carpeta InmoFlow si querés que ambos los vean).
