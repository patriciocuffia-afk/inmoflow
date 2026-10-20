// ═══════════════════════════════════════════
// COMUNICACIONES a locatarios y garantes
// ═══════════════════════════════════════════
function plantillasBase(){
  return {
    recordatorio: { nombre: 'Recordatorio de pago', texto: 'Hola {locatario}, te recordamos que el alquiler de {periodo} de {inmueble} es de {monto} y vence el {vencimiento}. Muchas gracias. {firma}' },
    ajuste: { nombre: 'Aviso de actualización', texto: 'Hola {locatario}, te informamos que según el contrato (actualización por {indice}) el alquiler de {inmueble} pasa de {montoAnterior} a {montoNuevo} a partir de {desde}. Cualquier consulta estamos a disposición. {firma}' },
    mora: { nombre: 'Reclamo de deuda', texto: 'Hola {locatario}, a la fecha registramos un saldo pendiente de {deuda} correspondiente a {detalleDeuda} del alquiler de {inmueble}. Te pedimos regularizarlo a la brevedad para evitar intereses punitorios. {firma}' },
    garante: { nombre: 'Aviso al garante', texto: 'Estimado/a {garante}: en su carácter de garante del contrato de locación de {inmueble} (locatario {locatario}), le informamos que existe un saldo impago de {deuda} ({detalleDeuda}). Le solicitamos interceda para su regularización. {firma}' },
    vencimiento: { nombre: 'Vencimiento de contrato', texto: 'Hola {locatario}, te recordamos que el contrato de {inmueble} finaliza el {fin}. Queremos saber si tenés intención de renovar para coordinar. {firma}' },
    recibo: { nombre: 'Confirmación de pago', texto: 'Hola {locatario}, recibimos tu pago de {ultimoPago} correspondiente a {ultimoPeriodo}. ¡Gracias! Te enviamos el recibo. {firma}' },
    libre: { nombre: 'Mensaje libre', texto: 'Hola {locatario}, ' }
  };
}
function variablesMsj(c, dest){
  var ph = perHoy(), pa = proximoAjuste(c), d = deudaContrato(c);
  var ms = montosOrd(c), ult = ms[ms.length - 1], ant = ms.length > 1 ? ms[ms.length - 2] : null;
  var aj = pa && (!ult || ult.desde < pa) ? calcularAjuste(c, pa) : null;
  var fila = cuentaCorriente(c).filas.filter(function(f){ return f.periodo === ph; })[0];
  var pagos = pagosDe(c.id).sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; });
  var i = byId('inmuebles', c.inmuebleId) || {};
  return {
    locatario: titulo(c.locatario.nombre),
    garante: dest && dest.nombre ? dest.nombre : ((c.garantes || [])[0] || {}).nombre || '',
    inmueble: i.direccion || i.nombre || '', direccion: i.direccion || '',
    periodo: perNom(ph), monto: fmt(montoVigente(c, ph)), vencimiento: fila ? fDate(fila.venc) : '',
    montoAnterior: aj ? fmt(aj.base) : (ant ? fmt(ant.monto) : ''), montoNuevo: aj ? fmt(aj.monto) : (ult ? fmt(ult.monto) : ''),
    desde: aj ? perNom(pa) : (ult ? perNom(ult.desde) : ''), indice: INDICES[c.indice] || c.indice,
    deuda: fmt(sum(d, function(f){ return f.debe - f.pagado; })), detalleDeuda: d.map(function(f){ return perNom(f.periodo); }).join(', ') || '—',
    fin: fDate(c.fin), firma: '\n' + (DB.config.administrador || DB.config.emisor || ''),
    ultimoPago: pagos[0] ? fmt(totalPago(pagos[0])) : '', ultimoPeriodo: pagos[0] ? perNom(pagos[0].periodo) : ''
  };
}
// "PEREZ JUANA" → "Perez Juana" para que el saludo no quede en mayúsculas.
function titulo(n){ return String(n || '').trim().toLowerCase().replace(/(^|[\s-])(\S)/g, function(m, a, b){ return a + b.toUpperCase(); }); }
function nombrePila(n){
  var p = String(n || '').trim().split(/\s+/);
  if (p.length < 2) return n;
  var s = p.length >= 3 ? p.slice(-1)[0] : p[1];
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function rellenar(t, v){ return t.replace(/\{(\w+)\}/g, function(m, k){ return v[k] != null ? v[k] : m; }); }
function telWA(t){
  var d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('54') === 0) { d = d.slice(2); }
  if (d.charAt(0) === '0') d = d.slice(1);
  if (d.charAt(0) === '9') d = d.slice(1);
  d = d.replace(/^(\d{2,4})15/, '$1');           // quita el 15 de celulares viejos
  return '549' + d;
}
function linkWA(tel, txt){ return 'https://wa.me/' + telWA(tel) + (txt ? '?text=' + encodeURIComponent(txt) : ''); }

function modalMensaje(cid, tipo){
  var c = byId('contratos', cid); if (!c) return;
  var pls = DB.config.plantillas, tp = tipo || 'libre';
  var dests = [['loc', 'Locatario: ' + c.locatario.nombre]].concat((c.garantes || []).map(function(g, k){ return ['g' + k, 'Garante: ' + g.nombre]; }));
  abrirModal('Mensaje — ' + esc(c.locatario.nombre),
    '<div class="fr">' + sel('m-dest', 'Destinatario', dests, tp === 'garante' ? 'g0' : 'loc', 'onchange="msjRellenar(\'' + cid + '\')"') + sel('m-tpl', 'Plantilla', Object.keys(pls).map(function(k){ return [k, pls[k].nombre]; }), tp, 'onchange="msjRellenar(\'' + cid + '\')"') + '</div>' +
    '<textarea class="f" id="m-txt" style="min-height:170px"></textarea><div class="hint" id="m-info" style="margin-top:6px"></div>',
    '<button class="btn" onclick="msjEnviar(\'' + cid + '\',\'copiar\')">Copiar</button><button class="btn" onclick="msjEnviar(\'' + cid + '\',\'mail\')">Email</button><button class="btn p" onclick="msjEnviar(\'' + cid + '\',\'wa\')">WhatsApp</button>');
  msjRellenar(cid);
}
function msjDest(c){ var d = val('m-dest'); return d === 'loc' ? c.locatario : (c.garantes || [])[+d.slice(1)] || {}; }
function msjRellenar(cid){
  var c = byId('contratos', cid), d = msjDest(c), t = DB.config.plantillas[val('m-tpl')];
  var v = variablesMsj(c, val('m-dest') === 'loc' ? null : d);
  $('m-txt').value = rellenar(t.texto, v);
  $('m-info').innerHTML = (d.tel ? 'WhatsApp: ' + esc(d.tel) : '<span style="color:var(--warn)">Sin celular cargado</span>') + ' · ' + (d.email ? 'Email: ' + esc(d.email) : '<span style="color:var(--warn)">Sin email</span>');
}
function msjEnviar(cid, canal){
  var c = byId('contratos', cid), d = msjDest(c), txt = val('m-txt');
  if (canal === 'wa') { if (!d.tel) { toast('Cargá el celular en el contrato'); return; } window.open(linkWA(d.tel, txt), '_blank'); }
  if (canal === 'mail') { if (!d.email) { toast('Cargá el email en el contrato'); return; } location.href = 'mailto:' + d.email + '?subject=' + encodeURIComponent(DB.config.plantillas[val('m-tpl')].nombre + ' — ' + nombreInm(c.inmuebleId)) + '&body=' + encodeURIComponent(txt); }
  if (canal === 'copiar') copiar(txt);
  guardar('comunicaciones', { contratoId: cid, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5), canal: canal, destinatario: d.nombre || '', rol: val('m-dest') === 'loc' ? 'Locatario' : 'Garante', plantilla: val('m-tpl'), texto: txt });
  cerrarModal(); renderTodo();
}
function detCtrMensajes(c){
  var l = vivos('comunicaciones').filter(function(m){ return m.contratoId === c.id; }).sort(function(a, b){ return (b.fecha + b.hora) > (a.fecha + a.hora) ? 1 : -1; });
  return '<div class="bar"><button class="btn p" onclick="modalMensaje(\'' + c.id + '\')">+ Nuevo mensaje</button>' + ['recordatorio', 'ajuste', 'mora', 'garante', 'vencimiento'].map(function(k){ return '<button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'' + k + '\')">' + esc(DB.config.plantillas[k].nombre) + '</button>'; }).join('') + '</div>' +
    (l.length ? l.map(htmlComunicacion).join('') : '<div class="card empty">Sin comunicaciones registradas.</div>');
}
function htmlComunicacion(m){
  return '<div class="card"><div class="row" style="padding:0"><span class="b">' + esc(m.rol) + ': ' + esc(m.destinatario) + ' <span class="tag t-mut">' + ({ wa: 'WhatsApp', mail: 'Email', copiar: 'Copiado' }[m.canal] || m.canal) + '</span></span><span class="small muted">' + fDate(m.fecha) + ' ' + esc(m.hora || '') + '</span></div><div class="small" style="white-space:pre-wrap;margin-top:6px">' + esc(m.texto) + '</div></div>';
}

var MASIVO = 'ajuste';
function renderAvisos(){
  var ph = perHoy(), lim = perAdd(ph, 1);
  var vig = vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; });
  var grupos = {
    ajuste: { t: 'Ajustan este mes o el próximo', f: function(c){ var p = proximoAjuste(c); return p && p <= lim; }, tpl: 'ajuste' },
    mora: { t: 'Con deuda', f: function(c){ return deudaContrato(c).length > 0; }, tpl: 'mora' },
    recordatorio: { t: 'Aún no pagaron este mes', f: function(c){ var f = cuentaCorriente(c).filas.filter(function(x){ return x.periodo === ph; })[0]; return f && f.estado !== 'pagado'; }, tpl: 'recordatorio' },
    vencimiento: { t: 'Contrato por vencer', f: function(c){ return c.fin && diasEntre(hoy(), c.fin) <= (DB.config.avisoVencimientoDias || 60); }, tpl: 'vencimiento' },
    todos: { t: 'Todos los vigentes', f: function(){ return true; }, tpl: 'libre' }
  };
  var g = grupos[MASIVO], lista = vig.filter(g.f);
  var hist = vivos('comunicaciones').sort(function(a, b){ return (b.fecha + b.hora) > (a.fecha + a.hora) ? 1 : -1; }).slice(0, 30);
  $('p-avisos').innerHTML = '<h2>Avisos y comunicaciones</h2><p class="sub">Mensajes por WhatsApp o email a locatarios y garantes, con los montos completados automáticamente.</p>' +
    '<div class="subtabs">' + Object.keys(grupos).map(function(k){ var n = vig.filter(grupos[k].f).length; return '<button class="' + (k === MASIVO ? 'on' : '') + '" onclick="MASIVO=\'' + k + '\';renderAvisos()">' + grupos[k].t + ' (' + n + ')</button>'; }).join('') + '</div>' +
    '<div class="tw"><table><thead><tr><th>Locatario</th><th>Inmueble</th><th>Mensaje sugerido</th><th></th></tr></thead><tbody>' +
    (lista.length ? lista.map(function(c){
      var txt = rellenar(DB.config.plantillas[g.tpl].texto, variablesMsj(c));
      return '<tr><td><b>' + esc(c.locatario.nombre) + '</b><div class="small muted">' + esc(c.locatario.tel || 'sin celular') + '</div></td><td>' + esc(nombreInm(c.inmuebleId)) + '</td><td class="small" style="max-width:460px">' + esc(txt) + '</td>' +
        '<td style="white-space:nowrap">' + (c.locatario.tel ? '<a class="btn sm p" target="_blank" rel="noopener" href="' + linkWA(c.locatario.tel, txt) + '" onclick="registrarMasivo(\'' + c.id + '\',\'' + g.tpl + '\')">WhatsApp</a> ' : '') + '<button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'' + g.tpl + '\')">Editar</button></td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty">Nadie en este grupo.</td></tr>') + '</tbody></table></div>' +
    '<h3 style="margin-top:20px">Últimas comunicaciones</h3>' + (hist.length ? hist.map(function(m){ var c = byId('contratos', m.contratoId); return htmlComunicacion(Object.assign({}, m, { rol: (c ? c.locatario.nombre + ' · ' : '') + m.rol })); }).join('') : '<div class="card empty">Todavía no se enviaron mensajes.</div>');
}
function registrarMasivo(cid, tpl){
  var c = byId('contratos', cid);
  guardar('comunicaciones', { contratoId: cid, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5), canal: 'wa', destinatario: c.locatario.nombre, rol: 'Locatario', plantilla: tpl, texto: rellenar(DB.config.plantillas[tpl].texto, variablesMsj(c)) });
  setTimeout(renderAvisos, 300);
}

// ═══════════════════════════════════════════
// DOCUMENTOS Y FOTOS (Google Drive o, sin conexión, en este dispositivo)
// ═══════════════════════════════════════════
var CATS_DOC = ['Contrato', 'Foto', 'Inventario', 'Garantía', 'DNI / recibo de sueldo', 'Escritura', 'Plano', 'Impuesto', 'Factura / comprobante', 'Otro'];
function htmlDocs(col, obj, compacto){
  var docs = obj.docs || [];
  return '<div class="bar">' + (compacto ? '' : '<select class="f" style="width:auto" id="doc-cat">' + CATS_DOC.map(function(c){ return '<option>' + c + '</option>'; }).join('') + '</select>') +
    '<button class="btn p" onclick="elegirArchivos(\'' + col + '\',\'' + obj.id + '\')">+ Subir archivos</button><span class="hint">' + (AUTH_TOKEN ? 'Se guardan en tu Google Drive (carpeta InmoFlow).' : 'Sin conexión a Google: se guardan solo en este dispositivo.') + '</span></div>' +
    (docs.length ? '<div class="docs">' + docs.map(function(d, k){
      var ext = (d.nombre.split('.').pop() || '').toUpperCase().slice(0, 4);
      return '<div class="doc"><div class="th" id="th-' + d.id + '" onclick="abrirDoc(\'' + col + '\',\'' + obj.id + '\',' + k + ')">' + (esImagen(d) ? '' : ext) + '</div><div class="ds"><div class="b" title="' + esc(d.nombre) + '">' + esc(d.nombre) + '</div><div class="muted">' + esc(d.cat || '') + ' · ' + fDate(d.fecha) + (d.local ? ' · local' : '') + '</div><div><a href="#" onclick="quitarDoc(\'' + col + '\',\'' + obj.id + '\',' + k + ');return false" style="color:var(--bad)">quitar</a></div></div></div>';
    }).join('') + '</div>' : '<div class="card empty">Sin archivos. Subí el contrato firmado, fotos del inmueble, inventario, etc.</div>');
}
function esImagen(d){ return /^image\//.test(d.tipo || '') || /\.(jpe?g|png|webp|gif|heic)$/i.test(d.nombre); }
function elegirArchivos(col, id){
  var fi = $('fileIn'); fi.multiple = true; fi.accept = col === 'gastos' ? 'image/*,application/pdf' : '';
  var cat = $('doc-cat') ? val('doc-cat') : (col === 'gastos' ? 'Factura / comprobante' : 'Otro');
  fi.onchange = function(){ subirArchivos(col, id, Array.prototype.slice.call(fi.files), cat); fi.value = ''; };
  fi.click();
}
// Comparte un archivo de Drive (solo lectura, sin mail) con los dueños que pueden ver ese registro.
var USUARIOS_CACHE = null;
function compartirConDuenos(driveId, col, obj){
  var socios = visiblePara(col, obj);
  var lista = USUARIOS_CACHE ? Promise.resolve(USUARIOS_CACHE) : (conFirebase() && esAdmin() ? fsListUsuarios().then(function(u){ return (USUARIOS_CACHE = u); }) : Promise.resolve([]));
  return lista.then(function(us){
    return Promise.all(us.filter(function(u){ return u.rol !== 'admin' && socios.indexOf(u.socioId) >= 0 && u.email; }).map(function(u){
      return fetch(DRIVE_FILES + '/' + driveId + '/permissions?sendNotificationEmail=false', { method: 'POST', headers: hdrs('application/json'), body: JSON.stringify({ role: 'reader', type: 'user', emailAddress: u.email }) });
    }));
  }).catch(function(e){ console.warn('compartir', e); });
}
function subirArchivos(col, id, files, cat){
  var obj = byId(col, id); if (!obj || !files.length) return;
  if (conFirebase() && !AUTH_TOKEN && !tokenGuardado()) { conDrive(function(){ subirArchivos(col, id, files, cat); }); return; }
  var carpeta = col === 'inmuebles' ? obj.nombre : col === 'contratos' ? 'Contrato ' + obj.locatario.nombre : 'Comprobantes de gastos';
  toast('Subiendo ' + files.length + ' archivo(s)…', 60000);
  files.reduce(function(acc, f){
    return acc.then(function(){
      var d = { id: uid(), nombre: f.name, tipo: f.type, size: f.size, fecha: hoy(), cat: cat };
      var p = AUTH_TOKEN ? driveSubir(f, carpeta).then(function(r){ d.driveId = r.id; d.url = r.webViewLink; return compartirConDuenos(r.id, col, obj); })
        : idbPut(d.id, f).then(function(){ d.local = true; });
      return p.then(function(){ obj.docs = (obj.docs || []).concat([d]); });
    });
  }, Promise.resolve()).then(function(){
    guardar(col, obj); toast('Archivos guardados');
    if (col === 'gastos') modalGasto(id); else renderTodo();
  }).catch(function(e){ console.error(e); toast('Error al subir: ' + e.message, 5000); });
}
function blobDoc(d){ return d.driveId && AUTH_TOKEN ? driveBlob(d.driveId) : idbGet(d.id); }
function abrirDoc(col, id, k){
  var d = (byId(col, id).docs || [])[k];
  // los dueños (y cualquiera sin permiso de Drive en esta sesión) lo abren en Google Drive, donde ya está compartido
  if (d.driveId && (!AUTH_TOKEN || soloLectura())) { if (d.url) window.open(d.url, '_blank'); else toast('Conectate con Google para abrirlo'); return; }
  var w = window.open('', '_blank');
  blobDoc(d).then(function(b){
    if (!b) { if (w) w.close(); toast('El archivo está guardado en otro dispositivo'); return; }
    var u = URL.createObjectURL(b); if (w) w.location = u; else window.open(u, '_blank');
  });
}
function quitarDoc(col, id, k){
  confirmar('¿Quitar este archivo?' + (AUTH_TOKEN ? ' (se mueve a la papelera de Drive)' : '')).then(function(ok){
    if (!ok) return;
    var o = byId(col, id), d = o.docs[k];
    if (d.driveId && AUTH_TOKEN) fetch(DRIVE_FILES + '/' + d.driveId, { method: 'PATCH', headers: hdrs('application/json'), body: JSON.stringify({ trashed: true }) });
    if (d.local) idbDel(d.id);
    o.docs.splice(k, 1); guardar(col, o);
    if (col === 'gastos') modalGasto(id); else renderTodo();
  });
}
var _thumbs = {};
function cargarMiniaturas(docs){
  docs.filter(esImagen).forEach(function(d){
    var el = $('th-' + d.id); if (!el) return;
    if (_thumbs[d.id]) { el.style.backgroundImage = 'url(' + _thumbs[d.id] + ')'; return; }
    if (d.driveId && !AUTH_TOKEN) return;
    blobDoc(d).then(function(b){ if (!b) return; _thumbs[d.id] = URL.createObjectURL(b); var e2 = $('th-' + d.id); if (e2) e2.style.backgroundImage = 'url(' + _thumbs[d.id] + ')'; }).catch(function(){});
  });
}
