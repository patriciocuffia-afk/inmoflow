# InmoFlow — usuarios, permisos y acceso de los dueños

## Cómo funciona

| Quién | Cómo entra | Qué puede hacer |
|---|---|---|
| **Patricio** (administrador) | Con su cuenta de Google | Ve y carga todo. |
| **Antonella** (administradora) | Con su cuenta de Google | Ve y carga todo. |
| **Benjamín** y cualquier otro dueño | Con su cuenta de Google, desde el celular o la computadora | **Solo ve** sus inmuebles (propios y en condominio): cobros, recibos, gastos, liquidación, rentabilidad y documentos. No puede cargar ni modificar nada. |
| **Locatarios** | Con su cuenta de Google | **Solo ven su alquiler**: monto, próxima actualización, pagos, recibos, su contrato y documentos. No ven datos del dueño, costos ni gastos. |

Todos (dueños y locatarios) tienen además **su propio chat privado con la administración**: lo leen solo esa persona y los administradores.

## Chat con la administración (desde la versión 2026-10-26)

- Cada locatario y cada dueño tiene su conversación en la pestaña *Mensajes*. Nadie puede leer la de otro: lo impiden las reglas del servidor (`inmoflow_mensajes`, campo `hilo`).
- Con la app abierta, se buscan mensajes nuevos cada 20 segundos y se avisa con un cartel, o con una notificación si la app quedó en segundo plano. Todavía no hay avisos con la app cerrada (push).
- Para que alguien use el chat tiene que tener usuario. Se da de alta en *Ajustes → Usuarios y permisos*, o desde el contrato: *Partes y datos → Dar acceso a la app al locatario*.
- Dueños y locatarios leen solo la configuración pública (`inmoflow_config/publico`): administrador, datos para pagar, comisión general y nombres de los socios. La configuración completa solo la leen los administradores.

- **El permiso lo aplica el servidor, no la pantalla.** Las reglas de Firestore (`firestore.rules`) solo le entregan a cada dueño los documentos donde figura en `visiblePara`. Ese campo lo calcula la app según la titularidad de cada inmueble. Aunque alguien manipule la app, la base no le devuelve datos ajenos.
- **Quién hizo cada cosa.** Cada registro guarda quién lo cargó y quién lo modificó por última vez, con fecha y hora; se ve al pie de cada formulario. Además, *Ajustes → Actividad* muestra el historial completo: alta, modificación o baja, de qué, y qué campos cambiaron. Ese historial no se puede editar ni borrar: las reglas solo permiten agregar.
- **Documentos y fotos.** Cada archivo que se sube se comparte en Google Drive, solo para ver y sin enviar mails, con los dueños de ese inmueble. El dueño lo abre en Drive con su cuenta.
- **Sesión.** Una vez que el dueño ingresa, la sesión queda abierta en su teléfono o computadora; no tiene que volver a ingresar cada vez. Al cerrar sesión se borra la copia local.
- **Probar la vista de un dueño.** En *Ajustes → Usuarios → "Ver como Cuffia Benjamín"* ves la app exactamente como la ve él.

## Configuración en Firebase (una sola vez, unos 15 minutos)

Hace falta un proyecto de Firebase con login de Google. Se recomienda un **proyecto nuevo solo para InmoFlow**. En el proyecto de OBRICK (`costo-de-obras`), cualquiera que tenga permisos de Google Cloud (IAM) puede saltearse las reglas.

1. Entrá a https://console.firebase.google.com → **Agregar proyecto** → nombre `inmoflow` (Analytics no hace falta).
2. **Compilación → Firestore Database → Crear base de datos** → modo **producción** → ubicación `southamerica-east1` (San Pablo).
3. **Firestore → Reglas**: borrá lo que haya, pegá el contenido de `firestore.rules` y tocá **Publicar**.
4. **Compilación → Authentication → Comenzar → Google → Habilitar** (elegí tu mail como correo de asistencia) → Guardar.
   Después, en la misma pantalla del proveedor Google, abrí **"Lista de IDs de clientes externos permitidos"** (*Whitelist client IDs from external projects*) y agregá:
   `485000953207-g3r6kjptl4dvoc8p0u1aj20nket5mdrm.apps.googleusercontent.com`
   (es el cliente de Google que ya usa OBRICK).
5. **Authentication → Configuración → Dominios autorizados → Agregar dominio**: `patriciocuffia-afk.github.io`.
6. **Configuración del proyecto (⚙) → General → Tus apps → Web (`</>`)** → registrar la app `InmoFlow` (sin Hosting). Copiá los valores `apiKey` y `projectId`.
   Pasame esos dos valores; los cargo en `src/12-auth.js` (`var FB = { apiKey: '…', projectId: '…' }`) y publico. La apiKey de Firebase no es secreta: lo que protege los datos son las reglas.
7. Ingresá a InmoFlow con `patriciocuffia@gmail.com`; queda como administrador automáticamente. En **Ajustes → Usuarios y permisos** agregá:
   - Antonella → *Administrador*, socio: ninguno.
   - Benjamín → *Dueño (solo lectura)*, socio: Cuffia Benjamín.
8. Si ya tenías datos cargados en modo local, hacé **Ajustes → Backup → Descargar** antes del paso 6 y **Restaurar** después de ingresar: se suben con los permisos nuevos.

## Cómo lo usa cada dueño

1. Le pasás el link: `https://patriciocuffia-afk.github.io/inmoflow/`
2. Toca **Ingresar con Google** con la cuenta que cargaste para él.
3. En el celular, la instala como app:
   - **Android (Chrome):** menú ⋮ → *Instalar app*.
   - **iPhone (Safari):** Compartir → *Agregar a inicio*.
4. Ve su Panel, sus inmuebles agrupados por dueño, los cobros y recibos, los gastos, su columna de la liquidación con el **neto a cobrar** y la rentabilidad. Todo actualizado en el momento en que Antonella carga algo.

## Límites a tener en cuenta

- Los dueños ven también los datos del locatario de sus inmuebles (nombre, DNI, teléfono), que forman parte de su contrato.
- En un inmueble en condominio, cada condómino ve el cobro completo, porque el inmueble es de ambos.
- La "Caja de la administración" y el registro de actividad solo los ven los administradores.
- Los archivos subidos antes de cargar al dueño como usuario no se comparten solos. Para compartirlos, volvé a subirlos o compartí la carpeta *InmoFlow* desde Drive.
