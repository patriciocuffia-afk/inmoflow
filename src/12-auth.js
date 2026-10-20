// ═══════════════════════════════════════════
// Usuarios, roles y sesión
// ─ Con Firebase configurado (FB.apiKey): cada persona entra con su cuenta de Google.
//   El servidor (reglas de Firestore, ver firestore.rules) decide qué puede leer cada uno:
//   administradores → todo; dueños → solo los documentos de sus inmuebles (campo visiblePara).
// ─ Sin Firebase: modo local / OBRICK (permisos IAM), todos como administrador.
// ═══════════════════════════════════════════
var FB = { apiKey: 'AIzaSyByP5f-8_10KNfjpELDldNMAuiqI9-Lgbs', projectId: 'inmoflow-92013' }; // proyecto Firebase "inmoflow" (ver SEGURIDAD.md)
// ?local=1 en la dirección: modo de prueba sin servidor (solo para desarrollo en esta PC)
if (/[?&]local=1\b/.test(location.search)) FB = { apiKey: '', projectId: '' };
var SUPERADMIN = 'patriciocuffia@gmail.com';     // siempre administrador (también está fijo en las reglas)
var ROLES = { admin: 'Administrador (acceso completo)', dueno: 'Dueño (solo lectura de sus inmuebles)' };

// USUARIO = { email, nombre, rol: 'admin'|'dueno', socioId }
var USUARIO = null, FB_SES = null, SIMULAR = null;
function conFirebase(){ return !!(FB.apiKey && FB.projectId); }
function esAdmin(){ return !SIMULAR && (!conFirebase() || (USUARIO && USUARIO.rol === 'admin')); }
function soloLectura(){ return !!SIMULAR || (conFirebase() && USUARIO && USUARIO.rol !== 'admin'); }
function socioDelUsuario(){ return SIMULAR || (USUARIO && USUARIO.socioId) || null; }
function quienSoy(){ return USUARIO ? (USUARIO.nombre || USUARIO.email) : (DB.config.usuarioLocal || 'Local'); }
function emailYo(){ return USUARIO ? USUARIO.email : 'local'; }

// ─── sesión Firebase por REST (sin SDK) ──────
function fbGuardarSes(s){ FB_SES = s; if (s) localStorage.setItem('inmoflow_fb', JSON.stringify(s)); else localStorage.removeItem('inmoflow_fb'); }
function fbCargarSes(){ try { FB_SES = JSON.parse(localStorage.getItem('inmoflow_fb') || 'null'); } catch (e) { FB_SES = null; } return FB_SES; }
// Cambia el token de Google (del botón "Ingresar con Google") por una sesión de Firebase.
function fbLoginConGoogle(googleToken){
  return fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' + FB.apiKey, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody: 'access_token=' + googleToken + '&providerId=google.com', requestUri: location.origin, returnSecureToken: true })
  }).then(function(r){ return r.json(); }).then(function(d){
    if (d.error) throw new Error('Firebase: ' + d.error.message);
    fbGuardarSes({ idToken: d.idToken, refreshToken: d.refreshToken, exp: Date.now() + (+d.expiresIn || 3600) * 1000, email: String(d.email || '').toLowerCase(), nombre: d.displayName || '' });
    return FB_SES;
  });
}
// Token vigente; si está por vencer lo renueva solo (la sesión dura hasta que se cierre).
function fbToken(){
  if (!FB_SES) return Promise.reject(new Error('Sin sesión'));
  if (FB_SES.exp > Date.now() + 120000) return Promise.resolve(FB_SES.idToken);
  return fetch('https://securetoken.googleapis.com/v1/token?key=' + FB.apiKey, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(FB_SES.refreshToken)
  }).then(function(r){ return r.json(); }).then(function(d){
    if (d.error) { fbGuardarSes(null); throw new Error('La sesión venció: volvé a ingresar'); }
    FB_SES.idToken = d.id_token; FB_SES.refreshToken = d.refresh_token; FB_SES.exp = Date.now() + (+d.expires_in || 3600) * 1000;
    fbGuardarSes(FB_SES);
    return FB_SES.idToken;
  });
}
// Perfil del usuario: documento inmoflow_usuarios/{email} (lo crean los administradores).
function fbCargarPerfil(){
  var email = FB_SES.email;
  return fsGetDoc('usuarios', email).then(function(f){
    if (!f) {
      if (email === SUPERADMIN) return fsPutUsuario({ email: email, nombre: FB_SES.nombre || 'Patricio Cuffia', rol: 'admin', socioId: 'patricio' }).then(function(u){ return u; });
      throw new Error('La cuenta ' + email + ' no está habilitada en InmoFlow. Pedile acceso a un administrador.');
    }
    return { email: email, nombre: f.nombre || FB_SES.nombre, rol: f.rol, socioId: f.socioId || '' };
  }).then(function(u){
    USUARIO = u; localStorage.setItem('inmoflow_usuario', JSON.stringify(u));
    if (u.rol !== 'admin' && u.socioId) { VISTA = u.socioId; }
    return u;
  });
}

// ─── pantalla de ingreso ─────────────────────
function mostrarLogin(msg){
  var el = $('login');
  el.innerHTML = '<div class="login-box"><div class="logo" style="justify-content:center;font-size:24px"><div class="logo-mark" style="width:40px;height:40px;font-size:20px">⌂</div><span>Inmo<b>Flow</b></span></div>' +
    '<p class="muted" style="text-align:center">Gestión de alquileres</p>' +
    '<button class="btn p" style="width:100%;justify-content:center;padding:12px" onclick="ingresar()">Ingresar con Google</button>' +
    (msg ? '<div class="alert bad" style="margin-top:14px"><div class="ic">!</div><div class="tx small">' + esc(msg) + '</div></div>' : '') +
    '<p class="hint" style="text-align:center;margin-top:16px">Los dueños ven solo la cuenta de sus inmuebles. La carga de datos la hace la administración.</p></div>';
  el.style.display = 'flex';
}
function ocultarLogin(){ $('login').style.display = 'none'; }
var _loginClient = null;
function ingresar(){
  if (!window.google || !google.accounts) { toast('Cargando Google… probá de nuevo'); return; }
  if (!_loginClient) _loginClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID, scope: 'openid email profile',
    callback: function(r){
      if (r.error) { mostrarLogin('No se pudo ingresar con Google.'); return; }
      setSync('busy', 'Ingresando…');
      fbLoginConGoogle(r.access_token).then(fbCargarPerfil).then(function(){
        ocultarLogin(); DB_LIMPIAR_SI_OTRO_USUARIO(); sincronizar(true); renderTodo();
        toast('Hola ' + quienSoy());
      }).catch(function(e){ fbGuardarSes(null); USUARIO = null; mostrarLogin(e.message); setSync('err', 'Sin sesión'); });
    }
  });
  _loginClient.requestAccessToken({ prompt: 'select_account' });
}
function salir(){
  confirmar('¿Cerrar la sesión en este dispositivo? Se borra la copia local de los datos.').then(function(ok){
    if (!ok) return;
    fbGuardarSes(null); USUARIO = null; AUTH_TOKEN = null;
    localStorage.removeItem('inmoflow_usuario'); localStorage.removeItem(LS_DB);
    location.reload();
  });
}
// Si en este dispositivo entra otra persona, no debe quedar la copia de datos del anterior.
function DB_LIMPIAR_SI_OTRO_USUARIO(){
  var prev = localStorage.getItem('inmoflow_ultimo_email');
  if (prev && prev !== USUARIO.email) { COLS.forEach(function(c){ DB[c] = []; }); DB.auditoria = []; PENDIENTES = {}; guardarLocal(); }
  localStorage.setItem('inmoflow_ultimo_email', USUARIO.email);
}

// ─── qué documentos ve cada dueño ────────────
// visiblePara = socios que pueden leer el documento. Lo calcula la app al guardar y lo verifican las reglas.
function visiblePara(col, o){
  var s = {};
  function add(id){ if (id) s[id] = true; }
  function deInm(id){ var i = byId('inmuebles', id); (i ? distribucionInm(i) : []).forEach(function(t){ add(t.socioId); }); }
  if (col === 'inmuebles') distribucionInm(o).forEach(function(t){ add(t.socioId); });
  else if (col === 'contratos') deInm(o.inmuebleId);
  else if (col === 'pagos') { (o.distribucion || []).forEach(function(t){ add(t.socioId); }); (o.recibio || []).forEach(function(r){ if (r.quien !== 'admin') add(r.quien); }); if (!o.distribucion) deInm(o.inmuebleId); }
  else if (col === 'gastos') { (o.distribucion || []).forEach(function(t){ add(t.socioId); }); if (String(o.pagadoPor).indexOf('socio:') === 0) add(o.pagadoPor.slice(6)); if (!o.distribucion) deInm(o.inmuebleId); }
  else if (col === 'movimientos') { add(o.socioId); add(o.destinoId); }
  else if (col === 'comunicaciones') { var c = byId('contratos', o.contratoId); if (c) deInm(c.inmuebleId); }
  return Object.keys(s);
}

// ─── auditoría: quién cargó o cambió cada cosa ─
DB.auditoria = [];
var NOMBRE_COL = { inmuebles: 'inmueble', contratos: 'contrato', pagos: 'cobro', gastos: 'gasto', comunicaciones: 'mensaje', movimientos: 'movimiento', config: 'configuración', usuarios: 'usuario' };
function resumenRegistro(col, o){
  if (col === 'pagos') { var c = byId('contratos', o.contratoId); return (c ? c.locatario.nombre : '') + ' · ' + perNom(o.periodo) + ' · ' + fmt(totalPago(o)) + (o.reciboNro ? ' · recibo ' + o.reciboNro : ''); }
  if (col === 'gastos') return (o.descripcion || o.categoria) + ' · ' + nombreInm(o.inmuebleId) + ' · ' + fmt(o.montoARS || o.monto);
  if (col === 'contratos') return (o.locatario && o.locatario.nombre) + ' · ' + nombreInm(o.inmuebleId);
  if (col === 'inmuebles') return o.nombre;
  if (col === 'movimientos') return textoMov(o, o.socioId) + ' · ' + fmt(o.monto);
  if (col === 'comunicaciones') return (o.destinatario || '') + ' (' + (o.canal || '') + ')';
  return '';
}
function registrarAuditoria(col, obj, anterior){
  var accion = obj.deleted && anterior && !anterior.deleted ? 'baja' : anterior ? 'modificación' : 'alta';
  var cambios = [];
  if (anterior && accion === 'modificación') Object.keys(Object.assign({}, anterior, obj)).forEach(function(k){
    if (['updatedAt', 'audit'].indexOf(k) >= 0) return;
    if (JSON.stringify(anterior[k]) !== JSON.stringify(obj[k])) cambios.push(k);
  });
  if (accion === 'modificación' && !cambios.length) return;
  var a = { id: uid(), fecha: new Date().toISOString(), email: emailYo(), usuario: quienSoy(), accion: accion, col: col, docId: obj.id, resumen: resumenRegistro(col, obj), cambios: cambios };
  DB.auditoria.push(a);
  if (DB.auditoria.length > 3000) DB.auditoria = DB.auditoria.slice(-3000);
  PENDIENTES['auditoria/' + a.id] = true;
}
function lineaAuditoria(o){
  if (!o || !o.audit) return '';
  var a = o.audit;
  return '<div class="hint audit">Cargado por <b>' + esc(a.creadoPor || '—') + '</b>' + (a.creadoEl ? ' el ' + fechaHora(a.creadoEl) : '') +
    (a.modPor && a.modEl !== a.creadoEl ? ' · última modificación: <b>' + esc(a.modPor) + '</b> el ' + fechaHora(a.modEl) : '') + '</div>';
}
function fechaHora(iso){ var d = new Date(iso); return isNaN(d) ? '' : fDate(iso.slice(0, 10)) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }

// ─── modo solo lectura en la interfaz ────────
// Las reglas del servidor ya impiden escribir; esto evita que el dueño vea botones que no puede usar.
var RX_ESCRITURA = /^(modal(Inmueble|Contrato|Gasto|Costo|Movimiento|Ajuste)\(|modalPago\(null|modalPago\(\)|guardar|eliminar|borrar|finalizar|reactivar|agregarSocio|elegir|importar|setRecibio|setMedio|quitarDoc|reciboOtroConcepto|aplicarAjuste|DB\.config|modalMensaje|registrarMasivo|modalUsuario|subirArchivos|ctrAdd)/;
function aplicarSoloLectura(root){
  if (!soloLectura() || !root) return;
  root.querySelectorAll('[onclick]').forEach(function(el){
    var oc = el.getAttribute('onclick').trim();
    if (RX_ESCRITURA.test(oc) || /;\s*(guardar|borrar)/.test(oc)) el.style.display = 'none';
  });
  root.querySelectorAll('[onchange]').forEach(function(el){ if (RX_ESCRITURA.test(el.getAttribute('onchange').trim()) || /^(setRecibio|setMedio|DB\.config)/.test(el.getAttribute('onchange').trim())) el.disabled = true; });
}
function aplicarSoloLecturaModal(){
  if (!soloLectura()) return;
  var m = $('modal');
  m.querySelectorAll('input,select,textarea').forEach(function(e){ e.disabled = true; });
  m.querySelectorAll('.mf button, .mb button').forEach(function(b){
    var oc = (b.getAttribute('onclick') || '').trim(), t = b.textContent.trim();
    if (RX_ESCRITURA.test(oc) || /^(Guardar|Eliminar|Aplicar|Importar|\+)/.test(t)) b.style.display = 'none';
  });
}

// ─── simular la vista de un dueño (solo administradores, solo en pantalla) ───
function simularDueno(socioId){
  SIMULAR = socioId || null;
  VISTA = socioId || 'total';
  document.body.classList.toggle('simulando', !!SIMULAR);
  ir(SIMULAR ? 'panel' : 'ajustes');
  if (SIMULAR) toast('Viendo como ' + nombreSocio(socioId) + ' (solo lectura). Tocá la barra de arriba para volver.', 5000);
}
