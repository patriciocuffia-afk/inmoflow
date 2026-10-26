// ═══════════════════════════════════════════
// MENSAJES: chat privado de cada locatario y cada dueño con la administración.
// Cada persona tiene su propia conversación (hilo 'h:<clave>'): la ve ella y los administradores.
// Nadie más puede leerla (lo controla el servidor, ver firestore.rules).
// Firestore por REST no avisa en tiempo real: se consulta cada 20 segundos mientras la app está abierta.
// ═══════════════════════════════════════════
var CHAT = { hilo: null, ultimo: 0, timer: null, leidos: null, primera: true };
function hiloDe(clave){ return 'h:' + clave; }
function claveDeHilo(h){ return String(h || '').slice(2); }
function miHilo(){ return hiloDe(claveUsuario()); }
function leidos(){ if (!CHAT.leidos) { try { CHAT.leidos = JSON.parse(localStorage.getItem('inmoflow_leidos') || '{}'); } catch (e) { CHAT.leidos = {}; } } return CHAT.leidos; }
function marcarLeido(h){ var l = leidos(), u = ultimoDeHilo(h); if (u) { l[h] = u.updatedAt; try { localStorage.setItem('inmoflow_leidos', JSON.stringify(l)); } catch (e) {} } }
function mensajesDe(h){ return (DB.mensajes || []).filter(function(m){ return m.hilo === h; }).sort(function(a, b){ return a.updatedAt - b.updatedAt; }); }
function ultimoDeHilo(h){ var ms = mensajesDe(h); return ms[ms.length - 1]; }
function esMio(m){ return m.autorEmail === emailYo(); }
function noLeidos(h){ var t = leidos()[h] || 0; return mensajesDe(h).filter(function(m){ return !esMio(m) && m.updatedAt > t && (esAdmin() ? m.autorRol !== 'admin' : m.autorRol === 'admin'); }).length; }
function totalNoLeidos(){
  if (esAdmin()) { var hs = {}; (DB.mensajes || []).forEach(function(m){ hs[m.hilo] = 1; }); return sum(Object.keys(hs), noLeidos); }
  return claveUsuario() ? noLeidos(miHilo()) : 0;
}

// ─── traer y enviar ──────────────────────────
function chatTraer(){
  if (!conFirebase() || !conectado() || SIMULAR) return Promise.resolve();
  var q = esAdmin()
    ? fsRunQuery('mensajes', { field: { fieldPath: 'updatedAt' }, op: 'GREATER_THAN', value: { integerValue: String(CHAT.ultimo) } })
    : (claveUsuario() ? fsRunQuery('mensajes', { field: { fieldPath: 'hilo' }, op: 'EQUAL', value: { stringValue: miHilo() } }) : Promise.resolve([]));
  return q.then(function(arr){
    var nuevos = [];
    DB.mensajes = DB.mensajes || [];
    arr.forEach(function(m){
      if (DB.mensajes.some(function(x){ return x.id === m.id; })) return;
      DB.mensajes.push(m); if (!esMio(m)) nuevos.push(m);
      if (m.updatedAt > CHAT.ultimo) CHAT.ultimo = m.updatedAt;
    });
    // reintenta los que no se pudieron enviar
    DB.mensajes.filter(function(m){ return m.pendiente; }).forEach(enviarAlServidor);
    if (nuevos.length) {
      guardarLocal();
      if (!CHAT.primera) avisarNuevos(nuevos);
      if (PAGINA === 'mensajes') renderMensajes(); else renderTabs();
    }
    CHAT.primera = false;
  }).catch(function(e){ console.warn('chat', e); });
}
function iniciarChat(){
  clearInterval(CHAT.timer);
  CHAT.ultimo = (DB.mensajes || []).reduce(function(a, m){ return Math.max(a, m.updatedAt || 0); }, 0);
  CHAT.timer = setInterval(chatTraer, 20000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) chatTraer(); });
}
function avisarNuevos(ms){
  var de = ms.filter(function(m){ return esAdmin() ? m.autorRol !== 'admin' : m.autorRol === 'admin'; });
  if (!de.length) return;
  var m = de[de.length - 1], quien = esAdmin() ? nombreClave(claveDeHilo(m.hilo)) : (m.autorNombre || 'Administración');
  if (!(PAGINA === 'mensajes' && !document.hidden && (!esAdmin() || CHAT.hilo === m.hilo))) toast('Mensaje nuevo de ' + quien, 4000);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('InmoFlow · ' + quien, { body: m.texto.slice(0, 120), icon: 'icon-192.png' }); } catch (e) {}
  }
}
function enviarAlServidor(m){
  if (!conFirebase() || !conectado()) return Promise.resolve();
  var limpio = Object.assign({}, m); delete limpio.pendiente;
  return fsPut('mensajes', limpio).then(function(){ m.pendiente = false; guardarLocal(); if (PAGINA === 'mensajes') renderMensajes(); })
    .catch(function(e){ console.warn('enviar', e); });
}
function chatEnviar(){
  if (SIMULAR) { toast('Estás viendo la app como otra persona: no se puede enviar'); return; }
  var ta = $('chat-txt'); if (!ta) return;
  var texto = ta.value.trim(); if (!texto) return;
  var h = esAdmin() ? CHAT.hilo : miHilo(); if (!h || h === 'h:') { toast('Elegí una conversación'); return; }
  var m = { id: uid(), hilo: h, texto: texto.slice(0, 4000), fecha: new Date().toISOString(), updatedAt: Date.now(),
    autorEmail: emailYo(), autorNombre: quienSoy(), autorRol: esAdmin() ? 'admin' : (esLocatario() ? 'locatario' : 'dueno'), pendiente: true };
  DB.mensajes = (DB.mensajes || []).concat([m]); guardarLocal();
  ta.value = ''; renderMensajes();
  if (conFirebase()) enviarAlServidor(m); else { m.pendiente = false; guardarLocal(); renderMensajes(); }
}

// ─── pantalla ────────────────────────────────
function etiquetaHilo(h){
  var k = claveDeHilo(h), loc = k.indexOf('loc:') === 0, c = loc ? byId('contratos', k.slice(4)) : null;
  return { nombre: nombreClave(k), rol: loc ? 'Locatario' : 'Dueño', sub: loc && c ? nombreInm(c.inmuebleId) : '' };
}
function horaMsj(m){ var d = new Date(m.fecha); return (fDate(m.fecha.slice(0, 10)) === fDate(hoy()) ? '' : fDate(m.fecha.slice(0, 10)) + ' ') + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function htmlHilo(h, titulo, subtitulo){
  var ms = mensajesDe(h);
  setTimeout(function(){ marcarLeido(h); renderTabs(); var b = $('chat-msgs'); if (b) b.scrollTop = b.scrollHeight; }, 0);
  return '<div class="chat-box"><div class="chat-h">' + (esAdmin() ? '<button class="btn sm ghost chat-back" onclick="CHAT.hilo=null;renderMensajes()" aria-label="Volver">‹</button>' : '') +
    '<div><b>' + esc(titulo) + '</b><div class="small muted">' + esc(subtitulo) + '</div></div></div>' +
    '<div class="chat-msgs" id="chat-msgs">' + (ms.length ? ms.map(function(m){
      var mio = esAdmin() ? m.autorRol === 'admin' : esMio(m);
      return '<div class="msg ' + (mio ? 'yo' : 'otro') + '"><div class="burb">' + (mio && !esAdmin() ? '' : '<div class="autor">' + esc(m.autorRol === 'admin' ? (m.autorNombre || 'Administración') : m.autorNombre) + '</div>') +
        esc(m.texto).replace(/\n/g, '<br>') + '<div class="hora">' + horaMsj(m) + (m.pendiente ? ' · enviando…' : '') + '</div></div></div>';
    }).join('') : '<div class="empty">Todavía no hay mensajes. Escribí el primero.</div>') + '</div>' +
    '<div class="chat-in"><textarea class="f" id="chat-txt" rows="2" placeholder="Escribí un mensaje…" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();chatEnviar()}"></textarea><button class="btn p" onclick="chatEnviar()">Enviar</button></div></div>';
}
function renderMensajes(){
  var el = $('p-mensajes'); if (!el) return;
  var txt = $('chat-txt') ? $('chat-txt').value : '';
  if (!esAdmin()) {
    var k = claveUsuario();
    el.innerHTML = '<h2>Mensajes</h2><p class="sub">Tu conversación con la administración. La leen solamente vos y los administradores.</p>' +
      (k ? htmlHilo(hiloDe(k), DB.config.administrador ? 'Administración · ' + DB.config.administrador : 'Administración', 'Consultas, reclamos, comprobantes de pago') : '<div class="card empty">Tu usuario no tiene una cuenta asociada todavía.</div>');
  } else {
    var hs = {}; (DB.mensajes || []).forEach(function(m){ hs[m.hilo] = 1; });
    if (CHAT.hilo) hs[CHAT.hilo] = 1;
    var lista = Object.keys(hs).map(function(h){ var u = ultimoDeHilo(h); return { h: h, u: u, n: noLeidos(h), e: etiquetaHilo(h) }; })
      .sort(function(a, b){ return ((b.u && b.u.updatedAt) || 0) - ((a.u && a.u.updatedAt) || 0); });
    var col = '<div class="chat-list"><div class="card-h" style="padding:10px 12px"><b>Conversaciones</b><button class="btn sm p" onclick="nuevaConversacion()">+ Nueva</button></div>' +
      (lista.length ? lista.map(function(x){
        return '<button class="chat-item' + (CHAT.hilo === x.h ? ' on' : '') + '" onclick="CHAT.hilo=\'' + x.h + '\';renderMensajes()"><span class="av">' + esc(iniciales(x.e.nombre)) + '</span><span class="ci-t"><b>' + esc(x.e.nombre) + '</b>' +
          '<span class="small muted">' + esc(x.e.rol) + (x.e.sub ? ' · ' + esc(x.e.sub) : '') + '</span><span class="small ci-u">' + (x.u ? esc((x.u.autorRol === 'admin' ? 'Vos: ' : '') + x.u.texto.slice(0, 60)) : 'sin mensajes') + '</span></span>' +
          (x.n ? '<span class="cnt">' + x.n + '</span>' : '') + '</button>';
      }).join('') : '<div class="empty small">Todavía no hay conversaciones.</div>') + '</div>';
    var e = CHAT.hilo ? etiquetaHilo(CHAT.hilo) : null;
    el.innerHTML = '<h2>Mensajes</h2><p class="sub">Cada locatario y cada dueño tiene su conversación privada con la administración. Solo los administradores ven todas.</p>' +
      '<div class="chat-wrap' + (CHAT.hilo ? ' abierto' : '') + '">' + col +
      (CHAT.hilo ? htmlHilo(CHAT.hilo, e.nombre, e.rol + (e.sub ? ' · ' + e.sub : '') + ' · conversación privada') : '<div class="chat-box chat-vacio"><div class="empty">Elegí una conversación o empezá una nueva.</div></div>') + '</div>';
  }
  if (txt && $('chat-txt')) $('chat-txt').value = txt;
}
function nuevaConversacion(){
  var socios = DB.config.socios.map(function(s){ return [s.id, 'Dueño · ' + s.nombre]; });
  var locs = vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; }).sort(function(a, b){ return a.locatario.nombre.localeCompare(b.locatario.nombre); })
    .map(function(c){ return ['loc:' + c.id, 'Locatario · ' + c.locatario.nombre + ' (' + nombreInm(c.inmuebleId) + ')']; });
  abrirModal('Nueva conversación', sel('nc-k', 'Con', locs.concat(socios), '') + '<div class="hint" style="margin-top:8px">Para que la persona lea y responda desde su celular, tiene que tener usuario (Ajustes → Usuarios y permisos).</div>',
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="CHAT.hilo=hiloDe(val(\'nc-k\'));cerrarModal();renderMensajes()">Abrir</button>');
}
