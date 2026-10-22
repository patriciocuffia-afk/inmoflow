// ═══════════════════════════════════════════
// InmoFlow — núcleo: utilidades, base de datos local y sincronización
// ═══════════════════════════════════════════
var APP_VERSION = '2026-10-22-1';
var OAUTH_CLIENT_ID = '485000953207-g3r6kjptl4dvoc8p0u1aj20nket5mdrm.apps.googleusercontent.com';
var PROJECT_ID = 'costo-de-obras';
var FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/datastore';
var COLS = ['inmuebles', 'contratos', 'pagos', 'gastos', 'comunicaciones', 'movimientos'];
var LS_DB = 'inmoflow_db', LS_COT = 'inmoflow_cotiz', LS_IDX = 'inmoflow_indices';

var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── utilidades ─────────────────────────────
function $(id){ return document.getElementById(id); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function num(v){ if (typeof v === 'number') return isFinite(v) ? v : 0; if (v == null || v === '') return 0; var s = String(v).trim().replace(/\$|\s/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isFinite(n) ? n : 0; }
function r2(n){ return Math.round(n * 100) / 100; }
function fmt(n){ return '$ ' + (Math.round(num(n))).toLocaleString('es-AR'); }
function fmt2(n){ return '$ ' + num(n).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtU(n){ return 'US$ ' + num(n).toLocaleString('es-AR', {maximumFractionDigits:0}); }
function fmtU2(n){ return 'US$ ' + num(n).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function pct(n, d){ return (num(n)).toLocaleString('es-AR', {maximumFractionDigits: d == null ? 1 : d}) + '%'; }
function hoy(){ var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function p2(n){ return (n < 10 ? '0' : '') + n; }
function per(fecha){ return String(fecha || hoy()).slice(0, 7); }               // 'YYYY-MM'
function perHoy(){ return per(hoy()); }
function perAdd(p, n){ var y = +p.slice(0, 4), m = +p.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + p2(m + 1); }
function perDiff(a, b){ return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); } // meses de a hasta b
function perNom(p){ if (!p) return ''; return MESES[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4); }
function perCorto(p){ return MESES[+p.slice(5, 7) - 1].slice(0, 3) + ' ' + p.slice(2, 4); }
function fDate(f){ if (!f) return ''; var a = f.split('-'); return a[2] + '/' + a[1] + '/' + a[0]; }
function diasEntre(a, b){ return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5); }
function addDias(f, n){ var d = new Date(f + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function finDeMes(p){ var d = new Date(+p.slice(0, 4), +p.slice(5, 7), 0); return p + '-' + p2(d.getDate()); }
function toast(msg, ms){ var t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function(){ t.style.display = 'none'; }, ms || 2600); }
function sum(arr, f){ var s = 0; for (var i = 0; i < arr.length; i++) s += num(f ? f(arr[i]) : arr[i]); return s; }
function byId(col, id){ return DB[col].find(function(x){ return x.id === id && !x.deleted; }) || null; }
function vivos(col){ return DB[col].filter(function(x){ return !x.deleted; }); }
function copiar(txt){ (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast('Copiado: ' + txt); }, function(){ prompt('Copiá el texto:', txt); }); }

// ─── base de datos local ────────────────────
var DB = { inmuebles: [], contratos: [], pagos: [], gastos: [], comunicaciones: [], movimientos: [], config: null };
var PENDIENTES = {}; // 'col/id' → true (cambios a subir a la nube)
var SNAP = {};       // 'col/id' → JSON de la última versión guardada (para la auditoría)
function rehacerSnap(){ SNAP = {}; COLS.forEach(function(c){ DB[c].forEach(function(o){ SNAP[c + '/' + o.id] = JSON.stringify(o); }); }); }

function configBase(){
  return {
    id: 'config',
    socios: [{ id: 'patricio', nombre: 'Cuffia Patricio', alias: 'PATRICIO' }, { id: 'benjamin', nombre: 'Cuffia Benjamín', alias: 'BENJAMIN' }],
    administrador: 'Antonella',
    emisor: 'Dr. Patricio Cuffia',
    emisorDatos: 'Río Segundo, Córdoba',
    comisionPct: 5,
    comisionBase: 'alquiler',     // 'alquiler' | 'total'
    punitorioDiarioPct: 0.1,
    diaVencimiento: 10,
    reciboPuntoVenta: '0001',
    reciboNro: 1,
    avisoAjusteDias: 30,
    avisoVencimientoDias: 60,
    categoriasGasto: ['Arreglos', 'Pintura', 'Electricidad', 'Plomería', 'Gas', 'Albañilería', 'Impuesto Rentas', 'Tasa municipal', 'Expensas', 'Seguro', 'Servicios', 'Honorarios', 'Mejora / inversión', 'Otros'],
    plantillas: null,
    updatedAt: 0
  };
}

function cargarLocal(){
  try {
    var raw = localStorage.getItem(LS_DB);
    if (raw) {
      var d = JSON.parse(raw);
      COLS.forEach(function(c){ DB[c] = d[c] || []; });
      DB.auditoria = d.auditoria || [];
      rehacerSnap();
      DB.config = d.config || null;
      PENDIENTES = d._pend || {};
    }
  } catch (e) { console.error('DB local corrupta', e); }
  var base = configBase();
  DB.config = Object.assign(base, DB.config || {});
  if (!DB.config.plantillas) DB.config.plantillas = plantillasBase();
}

function guardarLocal(){
  var d = { _pend: PENDIENTES, config: DB.config, auditoria: DB.auditoria || [] };
  COLS.forEach(function(c){ d[c] = DB[c]; });
  try { localStorage.setItem(LS_DB, JSON.stringify(d)); }
  catch (e) { alert('No se pudo guardar localmente (almacenamiento lleno). Exportá un backup.'); }
}

// Guarda (alta o modificación) un registro, lo marca para subir y re-renderiza.
function guardar(col, obj){
  if (soloLectura()) { toast('Tu usuario es de solo lectura'); return obj; }
  var ahora = new Date().toISOString();
  // versión anterior: la última guardada (los formularios modifican el objeto en el lugar antes de guardar)
  var anterior = obj.id && SNAP[col + "/" + obj.id] ? JSON.parse(SNAP[col + "/" + obj.id]) : null;
  obj.updatedAt = Date.now();
  if (!obj.id) obj.id = uid();
  if (!obj.creado) obj.creado = hoy();
  obj.audit = obj.audit || { creadoPor: quienSoy(), creadoEmail: emailYo(), creadoEl: ahora };
  obj.audit.modPor = quienSoy(); obj.audit.modEmail = emailYo(); obj.audit.modEl = ahora;
  var i = DB[col].findIndex(function(x){ return x.id === obj.id; });
  if (i >= 0) DB[col][i] = obj; else DB[col].push(obj);
  PENDIENTES[col + '/' + obj.id] = true;
  registrarAuditoria(col, obj, anterior);
  SNAP[col + "/" + obj.id] = JSON.stringify(obj);
  guardarLocal();
  programarSync();
  return obj;
}
function borrar(col, id){
  var o = DB[col].find(function(x){ return x.id === id; });
  if (!o) return;
  o = JSON.parse(JSON.stringify(o));
  o.deleted = true;
  guardar(col, o);
}
function guardarConfig(){
  if (soloLectura()) return;
  DB.config.updatedAt = Date.now();
  DB.config.modPor = quienSoy();
  PENDIENTES['config/config'] = true;
  guardarLocal();
  programarSync();
}

// ─── Google: login + Firestore + Drive ──────
// AUTH_TOKEN = token de Google para Drive (y para Firestore en el modo sin Firebase).
// Con Firebase, Firestore usa el token de la sesión de Firebase y aplica las reglas de seguridad.
var AUTH_TOKEN = null, tokenClient = null, SYNC_EST = 'local', _syncTimer = null;
function fsBase(){ return 'https://firestore.googleapis.com/v1/projects/' + (conFirebase() ? FB.projectId : PROJECT_ID) + '/databases/(default)/documents'; }
function conectado(){ return conFirebase() ? !!(FB_SES && USUARIO) : !!AUTH_TOKEN; }

function setSync(est, txt){
  SYNC_EST = est;
  $('sdot').className = 'dot ' + ({ on: 'on', busy: 'busy', err: 'err' }[est] || '');
  $('slabel').textContent = txt;
}
function clickSync(){
  if (conFirebase()) { if (!conectado()) mostrarLogin(); else sincronizar(true); return; }
  if (!AUTH_TOKEN) { conectarGoogle(); return; }
  sincronizar(true);
}
// Token de Google con permiso de Drive (archivos). En modo sin Firebase también da acceso a Firestore por IAM.
function conectarGoogle(silencioso, despues){
  if (!window.google || !google.accounts) { if (!silencioso) toast('Cargando Google… probá de nuevo en un segundo'); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID, scope: conFirebase() ? 'https://www.googleapis.com/auth/drive.file' : SCOPES,
    hint: USUARIO ? USUARIO.email : undefined,
    callback: function(r){
      if (r.error) { if (!conFirebase()) setSync('err', 'Error Google'); return; }
      AUTH_TOKEN = r.access_token;
      sessionStorage.setItem('inmoflow_tok', AUTH_TOKEN);
      sessionStorage.setItem('inmoflow_tok_exp', String(Date.now() + (r.expires_in || 3500) * 1000));
      if (!conFirebase()) { localStorage.setItem('inmoflow_google', '1'); sincronizar(true); }
      if (despues) despues();
    }
  });
  tokenClient.requestAccessToken({ prompt: '' });
}
// Para subir o abrir archivos: pide el permiso de Drive solo cuando hace falta.
function conDrive(fn){ if (AUTH_TOKEN || tokenGuardado()) return fn(); conectarGoogle(false, fn); }
function desconectarGoogle(){
  AUTH_TOKEN = null; sessionStorage.removeItem('inmoflow_tok'); localStorage.removeItem('inmoflow_google');
  setSync('local', 'Local'); renderTodo();
}
function tokenGuardado(){
  var t = sessionStorage.getItem('inmoflow_tok'), e = +sessionStorage.getItem('inmoflow_tok_exp') || 0;
  if (t && e > Date.now() + 60000) { AUTH_TOKEN = t; return true; }
  return false;
}
function hdrs(ct){ var h = { Authorization: 'Bearer ' + AUTH_TOKEN }; if (ct) h['Content-Type'] = ct; return h; }
function chk401(r){
  if (r.status === 401) { AUTH_TOKEN = null; sessionStorage.removeItem('inmoflow_tok'); setSync('err', 'Reconectar'); throw new Error('Sesión de Google vencida'); }
  if (r.status === 403) { setSync('err', 'Sin permiso'); throw new Error('Tu usuario no tiene permiso para esa operación (403)'); }
  return r;
}
// Headers para Firestore: sesión de Firebase (aplica reglas) o token de Google (IAM).
function fsHdrs(ct){
  var tok = conFirebase() ? fbToken() : Promise.resolve(AUTH_TOKEN);
  return tok.then(function(t){ var h = { Authorization: 'Bearer ' + t }; if (ct) h['Content-Type'] = ct; return h; });
}
function fsFetch(url, opts){
  return fsHdrs(opts && opts.body ? 'application/json' : null).then(function(h){ return fetch(url, Object.assign({}, opts || {}, { headers: h })); })
    .then(function(r){
      if (r.status === 401 && conFirebase()) { setSync('err', 'Ingresar'); throw new Error('La sesión venció: volvé a ingresar'); }
      if (r.status === 401) return chk401(r);
      if (r.status === 403) { setSync('err', 'Sin permiso'); throw new Error('Sin permiso para esa operación (403)'); }
      return r;
    });
}

// Cada registro se guarda como un documento Firestore con el JSON entero en un campo,
// más los campos que usan las reglas: visiblePara (qué socios lo pueden leer) y updatedBy.
function fsListAll(col){
  var out = [];
  function page(tok){
    return fsFetch(fsBase() + '/inmoflow_' + col + '?pageSize=300' + (tok ? '&pageToken=' + tok : ''))
      .then(function(r){ return r.json(); })
      .then(function(d){
        (d.documents || []).forEach(function(doc){ try { out.push(JSON.parse(doc.fields.json.stringValue)); } catch (e) {} });
        return d.nextPageToken ? page(d.nextPageToken) : out;
      });
  }
  return page();
}
// Para un dueño: solo los documentos donde figura en visiblePara (las reglas exigen esta consulta).
function fsQuerySocio(col, socioId){
  return fsFetch(fsBase() + ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'inmoflow_' + col }],
    where: { fieldFilter: { field: { fieldPath: 'visiblePara' }, op: 'ARRAY_CONTAINS', value: { stringValue: socioId } } }
  } }) }).then(function(r){ return r.json(); }).then(function(arr){
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function(x){ if (x.document) try { out.push(JSON.parse(x.document.fields.json.stringValue)); } catch (e) {} });
    return out;
  });
}
function fsGetDoc(col, id){
  return fsFetch(fsBase() + '/inmoflow_' + col + '/' + encodeURIComponent(id)).then(function(r){
    if (r.status === 404) return null;
    return r.json().then(function(d){
      var f = {};
      Object.keys(d.fields || {}).forEach(function(k){ var v = d.fields[k]; f[k] = v.stringValue != null ? v.stringValue : v.integerValue != null ? +v.integerValue : v.booleanValue; });
      if (f.json) try { return JSON.parse(f.json); } catch (e) {}
      return f;
    });
  }).catch(function(e){ if (/403/.test(e.message)) return null; throw e; });
}
function fsPut(col, obj){
  var vis = col === 'config' || col === 'auditoria' ? [] : visiblePara(col, obj);
  var body = { fields: {
    json: { stringValue: JSON.stringify(obj) },
    updatedAt: { integerValue: String(obj.updatedAt || Date.now()) },
    updatedBy: { stringValue: emailYo() },
    visiblePara: { arrayValue: { values: vis.map(function(s){ return { stringValue: s }; }) } }
  } };
  // la auditoría solo se crea (las reglas no permiten modificarla): si ya existe, ya se subió antes
  var soloCrear = col === 'auditoria' ? '?currentDocument.exists=false' : '';
  return fsFetch(fsBase() + '/inmoflow_' + col + '/' + encodeURIComponent(obj.id) + soloCrear, { method: 'PATCH', body: JSON.stringify(body) })
    .then(function(r){ if (!r.ok && !(soloCrear && (r.status === 400 || r.status === 409))) throw new Error('Firestore ' + r.status); })
    .catch(function(e){ if (soloCrear && /403/.test(e.message)) return; throw e; });
}
// Usuarios: campos planos (las reglas los leen para saber el rol de cada uno).
function fsPutUsuario(u){
  var email = String(u.email).toLowerCase().trim();
  var body = { fields: { email: { stringValue: email }, nombre: { stringValue: u.nombre || '' }, rol: { stringValue: u.rol }, socioId: { stringValue: u.socioId || '' }, updatedBy: { stringValue: emailYo() } } };
  return fsFetch(fsBase() + '/inmoflow_usuarios/' + encodeURIComponent(email), { method: 'PATCH', body: JSON.stringify(body) })
    .then(function(r){ if (!r.ok) throw new Error('No se pudo guardar el usuario (' + r.status + ')'); return { email: email, nombre: u.nombre, rol: u.rol, socioId: u.socioId || '' }; });
}
function fsListUsuarios(){
  return fsFetch(fsBase() + '/inmoflow_usuarios?pageSize=100').then(function(r){ return r.json(); }).then(function(d){
    return (d.documents || []).map(function(doc){ var f = doc.fields || {}; function s(k){ return f[k] ? f[k].stringValue : ''; } return { email: s('email'), nombre: s('nombre'), rol: s('rol'), socioId: s('socioId') }; });
  });
}
function fsDelUsuario(email){ return fsFetch(fsBase() + '/inmoflow_usuarios/' + encodeURIComponent(email), { method: 'DELETE' }); }

function programarSync(){
  if (!conectado()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(function(){ sincronizar(false); }, 1200);
}

var _sincronizando = false;
function sincronizar(traer){
  if (conFirebase()) { if (!conectado()) return Promise.resolve(); }
  else if (!AUTH_TOKEN && !tokenGuardado()) return Promise.resolve();
  if (_sincronizando) return Promise.resolve();
  _sincronizando = true;
  setSync('busy', 'Sincronizando…');
  var duenio = conFirebase() && USUARIO.rol !== 'admin';
  var p = Promise.resolve();
  if (traer) {
    var cols = duenio ? COLS : COLS.concat(['auditoria']);
    p = Promise.all(cols.map(function(c){
      var q = duenio ? (USUARIO.socioId ? fsQuerySocio(c, USUARIO.socioId) : Promise.resolve([])) : fsListAll(c);
      return q.then(function(arr){ return [c, arr]; });
    }).concat([fsGetDoc('config', 'config').then(function(cf){ return ['config', cf ? [cf] : []]; })]))
      .then(function(res){
        res.forEach(function(x){
          var c = x[0];
          if (duenio && c !== 'config') DB[c] = []; // el dueño conserva solo lo que el servidor le devuelve
          if (c === 'auditoria') {
            DB.auditoria = x[1].concat(DB.auditoria.filter(function(a){ return PENDIENTES['auditoria/' + a.id]; })).sort(function(a, b){ return a.fecha < b.fecha ? -1 : 1; });
            return;
          }
          x[1].forEach(function(rem){
            if (c === 'config') {
              if ((rem.updatedAt || 0) > (DB.config.updatedAt || 0) && !PENDIENTES['config/config']) DB.config = Object.assign(configBase(), rem);
              return;
            }
            var i = DB[c].findIndex(function(l){ return l.id === rem.id; });
            if (i < 0) DB[c].push(rem);
            else if ((rem.updatedAt || 0) > (DB[c][i].updatedAt || 0) && !PENDIENTES[c + '/' + rem.id]) DB[c][i] = rem;
          });
        });
        guardarLocal(); rehacerSnap();
      });
  }
  return p.then(function(){
    if (duenio) { PENDIENTES = {}; return; }
    var keys = Object.keys(PENDIENTES), fallas = [];
    // cada cambio se sube por separado: si uno falla, los demás siguen y el que falló se reintenta después
    return keys.reduce(function(acc, k){
      return acc.then(function(){
        var c = k.split('/')[0], id = k.slice(c.length + 1);
        var obj = c === 'config' ? DB.config : (DB[c] || []).find(function(x){ return x.id === id; });
        if (!obj) { delete PENDIENTES[k]; return; }
        if (c === 'config') obj.id = 'config';
        return fsPut(c, obj).then(function(){ delete PENDIENTES[k]; }).catch(function(e){ fallas.push(e.message); if (/sesión/i.test(e.message)) throw e; });
      });
    }, Promise.resolve()).then(function(){ if (fallas.length) throw new Error(fallas.length + ' cambio(s) no se pudieron subir (' + fallas[0] + '). Se reintenta en la próxima sincronización.'); });
  }).then(function(){
    guardarLocal();
    setSync('on', conFirebase() ? quienSoy() : 'Sincronizado');
    if (traer) renderTodo();
  }).catch(function(e){
    console.error(e);
    setSync('err', 'Error sync');
    toast(e.message || 'Error al sincronizar', 4000);
  }).then(function(){ _sincronizando = false; });
}

// ─── Drive (documentos y fotos) ──────────────
var DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,thumbnailLink,webViewLink';
var DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
var _carpetas = {};
function driveCarpeta(nombre, padre){
  var key = (padre || 'root') + '/' + nombre;
  if (_carpetas[key]) return Promise.resolve(_carpetas[key]);
  var q = "name='" + nombre.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false" + (padre ? " and '" + padre + "' in parents" : '');
  return fetch(DRIVE_FILES + '?q=' + encodeURIComponent(q) + '&fields=files(id)', { headers: hdrs() }).then(chk401).then(function(r){ return r.json(); })
    .then(function(d){
      if (d.files && d.files.length) return (_carpetas[key] = d.files[0].id);
      return fetch(DRIVE_FILES, { method: 'POST', headers: hdrs('application/json'), body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: padre ? [padre] : undefined }) })
        .then(chk401).then(function(r){ return r.json(); }).then(function(f){ return (_carpetas[key] = f.id); });
    });
}
function driveSubir(file, carpetaNombre){
  return driveCarpeta('InmoFlow').then(function(root){ return driveCarpeta(carpetaNombre, root); })
    .then(function(folder){
      var fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({ name: file.name, parents: [folder] })], { type: 'application/json' }));
      fd.append('file', file);
      return fetch(DRIVE_UP, { method: 'POST', headers: hdrs(), body: fd }).then(chk401).then(function(r){ if (!r.ok) throw new Error('Drive ' + r.status); return r.json(); });
    });
}
function driveBlob(driveId){
  return fetch(DRIVE_FILES + '/' + driveId + '?alt=media', { headers: hdrs() }).then(chk401).then(function(r){ return r.blob(); });
}

// ─── archivos locales (cuando no hay Google) ─
var _idb = null;
function idb(){
  if (_idb) return _idb;
  _idb = new Promise(function(res, rej){
    var rq = indexedDB.open('inmoflow_files', 1);
    rq.onupgradeneeded = function(){ rq.result.createObjectStore('f'); };
    rq.onsuccess = function(){ res(rq.result); };
    rq.onerror = function(){ rej(rq.error); };
  });
  return _idb;
}
function idbPut(id, blob){ return idb().then(function(db){ return new Promise(function(res, rej){ var tx = db.transaction('f', 'readwrite'); tx.objectStore('f').put(blob, id); tx.oncomplete = res; tx.onerror = function(){ rej(tx.error); }; }); }); }
function idbGet(id){ return idb().then(function(db){ return new Promise(function(res){ var rq = db.transaction('f').objectStore('f').get(id); rq.onsuccess = function(){ res(rq.result); }; rq.onerror = function(){ res(null); }; }); }); }
function idbDel(id){ return idb().then(function(db){ db.transaction('f', 'readwrite').objectStore('f').delete(id); }); }
