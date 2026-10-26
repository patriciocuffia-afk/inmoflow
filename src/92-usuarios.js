// ═══════════════════════════════════════════
// Usuarios y permisos, registro de actividad y "Mi cuenta"
// ═══════════════════════════════════════════
function htmlUsuariosCard(){
  var locs = vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; }).sort(function(a, b){ return a.locatario.nombre.localeCompare(b.locatario.nombre); });
  return '<div class="card" style="grid-column:1/-1"><div class="card-h"><h3>Usuarios y permisos</h3><button class="btn p sm" onclick="modalUsuario()">+ Usuario</button></div>' +
    '<p class="small muted" style="margin-top:0">Los <b>administradores</b> cargan y modifican todo y leen todas las conversaciones. Los <b>dueños</b> ven solo sus inmuebles. Los <b>locatarios</b> ven solo su alquiler (monto, pagos, recibos y contrato). Todos entran con su cuenta de Google desde el celular o la computadora, y cada uno tiene su chat privado con la administración.' +
    (conFirebase() ? '' : ' <span class="tag t-warn">Falta activar Firebase: hasta entonces los permisos no se aplican en el servidor (ver SEGURIDAD.md)</span>') + '</p>' +
    '<div id="usr-list"><div class="hint">Cargando…</div></div>' +
    '<div class="card-h" style="margin-top:14px"><span class="small muted">Ver la app exactamente como la ve cada persona (solo en esta pantalla):</span></div><div class="chips">' +
    DB.config.socios.map(function(s){ return '<button class="btn sm" onclick="simularDueno(\'' + s.id + '\')">Ver como ' + esc(s.nombre) + '</button>'; }).join('') +
    (locs.length ? '<select class="f" style="width:auto" onchange="if(this.value)simularDueno(this.value)"><option value="">Ver como locatario…</option>' + locs.map(function(c){ return '<option value="loc:' + c.id + '">' + esc(c.locatario.nombre) + '</option>'; }).join('') + '</select>' : '') +
    '</div></div>';
}
function cargarUsuarios(){
  return conFirebase() ? fsListUsuarios().then(function(u){ USUARIOS_CACHE = u; return u; }) : Promise.resolve(DB.config.usuarios || []);
}
function permisoUsuario(u){
  if (u.rol === 'admin') return ['<span class="tag t-ok">Administrador</span>', 'Todo'];
  if (u.rol === 'locatario') { var c = byId('contratos', u.contratoId); return ['<span class="tag t-blue">Locatario</span>', c ? esc(nombreInm(c.inmuebleId)) : '—']; }
  return ['<span class="tag t-info">Dueño · solo lectura</span>', esc(u.socioId ? nombreSocio(u.socioId) : '—')];
}
function pintarUsuarios(){
  var el = $('usr-list'); if (!el) return;
  cargarUsuarios().then(function(us){
    var orden = { admin: 0, dueno: 1, locatario: 2 };
    us = us.slice().sort(function(a, b){ return (orden[a.rol] || 0) - (orden[b.rol] || 0) || (a.nombre || a.email).localeCompare(b.nombre || b.email); });
    el.innerHTML = us.length ? '<div class="tw"><table><thead><tr><th>Nombre</th><th>Cuenta de Google</th><th>Permiso</th><th>Ve</th><th></th></tr></thead><tbody>' + us.map(function(u){
      var pm = permisoUsuario(u);
      return '<tr><td><b>' + esc(u.nombre || '') + '</b></td><td>' + esc(u.email) + '</td><td>' + pm[0] + '</td><td class="small">' + pm[1] + '</td><td><button class="btn sm" onclick="modalUsuario(\'' + esc(u.email) + '\')">Editar</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="hint">Todavía no hay usuarios.</div>';
  }).catch(function(e){ el.innerHTML = '<div class="hint">No se pudieron leer los usuarios: ' + esc(e.message) + '</div>'; });
}
// prefill: datos sugeridos para un alta (por ejemplo desde un contrato: el locatario)
function modalUsuario(email, prefill){
  cargarUsuarios().then(function(us){
    var u = email ? us.filter(function(x){ return x.email === email; })[0] : Object.assign({ email: '', nombre: '', rol: 'dueno', socioId: '', contratoId: '' }, prefill || {});
    var locs = vivos('contratos').filter(function(c){ return estadoContrato(c) !== 'finalizado' || c.id === u.contratoId; }).sort(function(a, b){ return a.locatario.nombre.localeCompare(b.locatario.nombre); });
    abrirModal(email ? 'Editar usuario' : 'Nuevo usuario',
      '<div class="fr">' + inp('us-mail', 'Cuenta de Google (email)', u.email, 'email', email ? 'disabled' : 'placeholder="nombre@gmail.com"') + inp('us-nom', 'Nombre', u.nombre, 'text') + '</div>' +
      '<div class="fr">' + sel('us-rol', 'Permiso', [['locatario', ROLES.locatario], ['dueno', ROLES.dueno], ['admin', ROLES.admin]], u.rol, 'onchange="usRol()"') +
        '<div id="us-socio-w">' + sel('us-socio', 'Es el socio / dueño', [['', '— ninguno (ej. administradora) —']].concat(DB.config.socios.map(function(s){ return [s.id, s.nombre]; })), u.socioId) + '</div>' +
        '<div id="us-ctr-w">' + sel('us-ctr', 'Contrato', [['', '— elegir —']].concat(locs.map(function(c){ return [c.id, c.locatario.nombre + ' · ' + nombreInm(c.inmuebleId)]; })), u.contratoId) + '</div></div>' +
      '<div class="hint" id="us-ayuda"></div>' +
      (u.email && !/@gmail\.com$/i.test(u.email) ? '<div class="hint" style="margin-top:6px">Este mail no es de Gmail: para ingresar necesita una cuenta de Google creada con esa dirección (accounts.google.com → Crear cuenta → Usar mi dirección de correo actual).</div>' : ''),
      (email && email !== SUPERADMIN ? '<button class="btn d" onclick="borrarUsuario(\'' + esc(email) + '\')">Quitar acceso</button><span style="flex:1"></span>' : '') +
      '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarUsuario(\'' + esc(email || '') + '\')">Guardar</button>');
    usRol();
  });
}
function usRol(){
  var r = val('us-rol');
  $('us-socio-w').style.display = r === 'locatario' ? 'none' : '';
  $('us-ctr-w').style.display = r === 'locatario' ? '' : 'none';
  $('us-ayuda').textContent = {
    locatario: 'Ve solo su alquiler: monto actual, próxima actualización, pagos y recibos, su contrato y documentos, y su chat con la administración. No ve datos del dueño, costos ni gastos.',
    dueno: 'Ve solo los inmuebles donde ese socio figura en la titularidad (propios y compartidos): cobros, gastos, recibos, liquidación y rentabilidad, y su chat con la administración. No puede cargar ni modificar nada.',
    admin: 'Carga y modifica todo, y lee todas las conversaciones.'
  }[r];
}
function guardarUsuario(email){
  var r = val('us-rol');
  var u = { email: (email || val('us-mail')).toLowerCase().trim(), nombre: val('us-nom'), rol: r, socioId: r === 'locatario' ? '' : val('us-socio'), contratoId: r === 'locatario' ? val('us-ctr') : '' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) { toast('Email inválido'); return; }
  if (u.rol === 'dueno' && !u.socioId) { toast('Elegí de qué socio es dueño'); return; }
  if (u.rol === 'locatario' && !u.contratoId) { toast('Elegí el contrato del locatario'); return; }
  if (u.email === SUPERADMIN && u.rol !== 'admin') { toast('Esta cuenta es siempre administradora'); return; }
  var p = conFirebase() ? fsPutUsuario(u) : Promise.resolve().then(function(){
    DB.config.usuarios = (DB.config.usuarios || []).filter(function(x){ return x.email !== u.email; }).concat([u]); guardarConfig();
  });
  p.then(function(){
    var desc = u.rol === 'admin' ? 'administrador' : u.rol === 'locatario' ? 'locatario de ' + nombreClave('loc:' + u.contratoId) : 'dueño de ' + nombreSocio(u.socioId);
    auditoriaManual(email ? 'modificación' : 'alta', 'usuarios', u.email, u.email + ' → ' + desc);
    USUARIOS_CACHE = null; cerrarModal(); toast('Usuario guardado'); pintarUsuarios();
  }).catch(function(e){ toast(e.message, 5000); });
}
function borrarUsuario(email){
  confirmar('¿Quitarle el acceso a ' + email + '?').then(function(ok){
    if (!ok) return;
    var p = conFirebase() ? fsDelUsuario(email) : Promise.resolve().then(function(){ DB.config.usuarios = (DB.config.usuarios || []).filter(function(x){ return x.email !== email; }); guardarConfig(); });
    p.then(function(){
      auditoriaManual('baja', 'usuarios', email, 'Se quitó el acceso a ' + email);
      USUARIOS_CACHE = null; cerrarModal(); pintarUsuarios();
    });
  });
}

function auditoriaManual(accion, col, docId, resumen){
  var a = { id: uid(), fecha: new Date().toISOString(), email: emailYo(), usuario: quienSoy(), accion: accion, col: col, docId: docId, resumen: resumen, cambios: [] };
  DB.auditoria.push(a); PENDIENTES['auditoria/' + a.id] = true; guardarLocal(); programarSync();
}

// ─── registro de actividad ───────────────────
var FILTRO_ACT = '';
function htmlActividad(){
  var l = (DB.auditoria || []).filter(function(a){ return !FILTRO_ACT || a.email === FILTRO_ACT; }).slice(-150).reverse();
  var quienes = {}; (DB.auditoria || []).forEach(function(a){ quienes[a.email] = a.usuario; });
  return '<div class="card" style="grid-column:1/-1"><div class="card-h"><h3>Actividad: quién cargó o modificó cada cosa</h3>' +
    '<select class="f" style="width:auto" onchange="FILTRO_ACT=this.value;renderAjustes()"><option value="">Todos los usuarios</option>' + Object.keys(quienes).map(function(e){ return '<option value="' + esc(e) + '"' + (FILTRO_ACT === e ? ' selected' : '') + '>' + esc(quienes[e]) + '</option>'; }).join('') + '</select></div>' +
    (l.length ? '<div class="tw" style="max-height:420px;overflow:auto"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' + l.map(function(a){
      var tag = { alta: 't-ok', 'modificación': 't-info', baja: 't-bad' }[a.accion] || 't-mut';
      return '<tr><td class="small" style="white-space:nowrap">' + fechaHora(a.fecha) + '</td><td><b>' + esc(a.usuario) + '</b></td><td><span class="tag ' + tag + '">' + esc(a.accion) + '</span> ' + esc(NOMBRE_COL[a.col] || a.col) + '</td>' +
        '<td class="small">' + esc(a.resumen || '') + (a.cambios && a.cambios.length ? '<div class="muted">cambió: ' + esc(a.cambios.join(', ')) + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="hint">Sin actividad registrada todavía.</div>') + '</div>';
}

// ─── Mi cuenta (dueños) ──────────────────────
function renderMiCuenta(){
  var s = socioDelUsuario();
  var inms = vivos('inmuebles').filter(function(i){ return factorInm(i) > 0; });
  var loc = esLocatario(), c = loc ? byId('contratos', contratoDelUsuario()) : null;
  $('p-ajustes').innerHTML = '<h2>Mi cuenta</h2><p class="sub">Acceso de consulta: ' + (loc ? 'ves tu alquiler, tus pagos y recibos' : 'ves la cuenta de tus inmuebles') + '. La carga de datos la hace la administración.</p><div class="grid g2">' +
    '<div class="card"><h3>' + esc(SIMULAR ? nombreClave(SIMULAR) : quienSoy()) + '</h3><div class="kv">' +
      '<div>Cuenta</div><div>' + esc(USUARIO ? USUARIO.email : '(vista simulada)') + '</div>' +
      '<div>Permiso</div><div><span class="tag t-info">' + (loc ? 'Locatario' : 'Dueño · solo lectura') + '</span></div>' +
      (loc ? '<div>Inmueble</div><div>' + esc(c ? nombreInm(c.inmuebleId) : '—') + '</div>' : '<div>Inmuebles</div><div>' + inms.length + '</div>') +
      '<div>Administración</div><div>' + esc(DB.config.administrador || '') + '</div></div>' +
      (SIMULAR ? '<button class="btn" style="margin-top:12px" onclick="simularDueno(null)">Volver a la vista de administrador</button>' : '<button class="btn" style="margin-top:12px" onclick="salir()">Cerrar sesión</button>') + '</div>' +
    '<div class="card"><h3>Usarla en el celular</h3><ol class="small" style="padding-left:18px;margin:0">' +
      '<li><b>Android (Chrome):</b> abrí el link, tocá el menú ⋮ → <i>Agregar a la pantalla principal</i> / <i>Instalar app</i>.</li>' +
      '<li><b>iPhone (Safari):</b> abrí el link, tocá Compartir → <i>Agregar a inicio</i>.</li>' +
      '<li>Queda como una app más. La sesión se mantiene: no hace falta volver a ingresar cada vez.</li></ol></div>' +
  '</div>';
}
function darAccesoLocatario(cid){
  var c = byId('contratos', cid); if (!c) return;
  modalUsuario(null, { email: (c.locatario.email || '').toLowerCase(), nombre: c.locatario.nombre, rol: 'locatario', contratoId: c.id });
}
