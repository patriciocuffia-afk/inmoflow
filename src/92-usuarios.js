// ═══════════════════════════════════════════
// Usuarios y permisos, registro de actividad y "Mi cuenta"
// ═══════════════════════════════════════════
function htmlUsuariosCard(){
  return '<div class="card" style="grid-column:1/-1"><div class="card-h"><h3>Usuarios y permisos</h3><button class="btn p sm" onclick="modalUsuario()">+ Usuario</button></div>' +
    '<p class="small muted" style="margin-top:0">Los <b>administradores</b> cargan y modifican todo. Los <b>dueños</b> entran con su cuenta de Google y solo <b>ven</b> la cuenta de sus inmuebles (los que figuran a su nombre en la titularidad), desde el celular o la computadora.' +
    (conFirebase() ? '' : ' <span class="tag t-warn">Falta activar Firebase: hasta entonces los permisos no se aplican en el servidor (ver SEGURIDAD.md)</span>') + '</p>' +
    '<div id="usr-list"><div class="hint">Cargando…</div></div>' +
    '<div class="card-h" style="margin-top:14px"><span class="small muted">Ver la app exactamente como la ve cada dueño (solo en esta pantalla):</span></div><div class="chips">' +
    DB.config.socios.map(function(s){ return '<button class="btn sm" onclick="simularDueno(\'' + s.id + '\')">Ver como ' + esc(s.nombre) + '</button>'; }).join('') + '</div></div>';
}
function cargarUsuarios(){
  return conFirebase() ? fsListUsuarios().then(function(u){ USUARIOS_CACHE = u; return u; }) : Promise.resolve(DB.config.usuarios || []);
}
function pintarUsuarios(){
  var el = $('usr-list'); if (!el) return;
  cargarUsuarios().then(function(us){
    us = us.slice().sort(function(a, b){ return (a.rol === 'admin' ? 0 : 1) - (b.rol === 'admin' ? 0 : 1) || (a.nombre || a.email).localeCompare(b.nombre || b.email); });
    el.innerHTML = us.length ? '<div class="tw"><table><thead><tr><th>Nombre</th><th>Cuenta de Google</th><th>Permiso</th><th>Ve los inmuebles de</th><th></th></tr></thead><tbody>' + us.map(function(u){
      return '<tr><td><b>' + esc(u.nombre || '') + '</b></td><td>' + esc(u.email) + '</td><td>' + (u.rol === 'admin' ? '<span class="tag t-ok">Administrador</span>' : '<span class="tag t-info">Dueño · solo lectura</span>') + '</td>' +
        '<td>' + (u.rol === 'admin' ? 'Todos' : esc(u.socioId ? nombreSocio(u.socioId) : '—')) + '</td><td><button class="btn sm" onclick="modalUsuario(\'' + esc(u.email) + '\')">Editar</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="hint">Todavía no hay usuarios. Agregá a Antonella como administradora y a Benjamín como dueño.</div>';
  }).catch(function(e){ el.innerHTML = '<div class="hint">No se pudieron leer los usuarios: ' + esc(e.message) + '</div>'; });
}
function modalUsuario(email){
  cargarUsuarios().then(function(us){
    var u = email ? us.filter(function(x){ return x.email === email; })[0] : { email: '', nombre: '', rol: 'dueno', socioId: '' };
    abrirModal(email ? 'Editar usuario' : 'Nuevo usuario',
      '<div class="fr">' + inp('us-mail', 'Cuenta de Google (email)', u.email, 'email', email ? 'disabled' : 'placeholder="nombre@gmail.com"') + inp('us-nom', 'Nombre', u.nombre, 'text', 'placeholder="Ej: Antonella"') + '</div>' +
      '<div class="fr">' + sel('us-rol', 'Permiso', [['dueno', ROLES.dueno], ['admin', ROLES.admin]], u.rol) +
        sel('us-socio', 'Es el socio / dueño', [['', '— ninguno (ej. administradora) —']].concat(DB.config.socios.map(function(s){ return [s.id, s.nombre]; })), u.socioId) + '</div>' +
      '<div class="hint">Un dueño ve solo los inmuebles donde ese socio figura en la titularidad (los propios y los compartidos), con sus cobros, gastos, recibos, liquidación y rentabilidad. No puede cargar ni modificar nada.</div>',
      (email && email !== SUPERADMIN ? '<button class="btn d" onclick="borrarUsuario(\'' + esc(email) + '\')">Quitar acceso</button><span style="flex:1"></span>' : '') +
      '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarUsuario(\'' + esc(email || '') + '\')">Guardar</button>');
  });
}
function guardarUsuario(email){
  var u = { email: (email || val('us-mail')).toLowerCase().trim(), nombre: val('us-nom'), rol: val('us-rol'), socioId: val('us-socio') };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) { toast('Email inválido'); return; }
  if (u.rol === 'dueno' && !u.socioId) { toast('Elegí de qué socio es dueño'); return; }
  if (u.email === SUPERADMIN && u.rol !== 'admin') { toast('Esta cuenta es siempre administradora'); return; }
  var p = conFirebase() ? fsPutUsuario(u) : Promise.resolve().then(function(){
    DB.config.usuarios = (DB.config.usuarios || []).filter(function(x){ return x.email !== u.email; }).concat([u]); guardarConfig();
  });
  p.then(function(){
    auditoriaManual(email ? 'modificación' : 'alta', 'usuarios', u.email, u.email + ' → ' + (u.rol === 'admin' ? 'administrador' : 'dueño de ' + nombreSocio(u.socioId)));
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
  $('p-ajustes').innerHTML = '<h2>Mi cuenta</h2><p class="sub">Acceso de consulta: ves la cuenta de tus inmuebles. La carga de datos la hace la administración.</p><div class="grid g2">' +
    '<div class="card"><h3>' + esc(SIMULAR ? nombreSocio(SIMULAR) : quienSoy()) + '</h3><div class="kv">' +
      '<div>Cuenta</div><div>' + esc(USUARIO ? USUARIO.email : '(vista simulada)') + '</div>' +
      '<div>Permiso</div><div><span class="tag t-info">Dueño · solo lectura</span></div>' +
      '<div>Inmuebles</div><div>' + inms.length + '</div>' +
      '<div>Administración</div><div>' + esc(DB.config.administrador || '') + '</div></div>' +
      (SIMULAR ? '<button class="btn" style="margin-top:12px" onclick="simularDueno(null)">Volver a la vista de administrador</button>' : '<button class="btn" style="margin-top:12px" onclick="salir()">Cerrar sesión</button>') + '</div>' +
    '<div class="card"><h3>Usarla en el celular</h3><ol class="small" style="padding-left:18px;margin:0">' +
      '<li><b>Android (Chrome):</b> abrí el link, tocá el menú ⋮ → <i>Agregar a la pantalla principal</i> / <i>Instalar app</i>.</li>' +
      '<li><b>iPhone (Safari):</b> abrí el link, tocá Compartir → <i>Agregar a inicio</i>.</li>' +
      '<li>Queda como una app más. La sesión se mantiene: no hace falta volver a ingresar cada vez.</li></ol></div>' +
  '</div>';
}
