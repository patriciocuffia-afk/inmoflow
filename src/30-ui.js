// ═══════════════════════════════════════════
// UI: navegación, modal, panel y alertas
// ═══════════════════════════════════════════
var TABS = [
  ['panel', 'Panel'], ['inmuebles', 'Inmuebles'], ['contratos', 'Contratos'], ['pagos', 'Cobros'], ['recibos', 'Recibos'],
  ['gastos', 'Gastos'], ['liquidacion', 'Liquidación'], ['rentabilidad', 'Rentabilidad'],
  ['avisos', 'Avisos'], ['ajustes', 'Ajustes']
];
var PAGINA = 'panel', DETALLE = null; // DETALLE = {tipo:'inmueble'|'contrato', id, sub}

function renderTabs(){
  var nAl = alertas().filter(function(a){ return a.nivel === 'bad' || a.nivel === 'warn'; }).length;
  var ocultas = soloLectura() ? ['avisos'] : [];
  if (soloLectura()) VISTA = socioDelUsuario() || VISTA;
  $('vista').style.display = soloLectura() ? 'none' : '';
  $('userchip').innerHTML = USUARIO || SIMULAR ? '<span class="user-chip" onclick="ir(\'ajustes\')" title="Mi cuenta"><span class="av">' + esc(iniciales(SIMULAR ? nombreSocio(SIMULAR) : quienSoy())) + '</span><span class="nm">' + esc(SIMULAR ? nombreSocio(SIMULAR) : quienSoy()) + '</span>' + (soloLectura() ? '<span class="ro-tag">solo lectura</span>' : '') + '</span>' : '';
  $('tabs').innerHTML = TABS.filter(function(t){ return ocultas.indexOf(t[0]) < 0; }).map(function(t){
    if (t[0] === 'ajustes' && soloLectura()) t = ['ajustes', 'Mi cuenta'];
    var on = PAGINA === t[0] || (PAGINA === 'detalle' && DETALLE && ((DETALLE.tipo === 'inmueble' && t[0] === 'inmuebles') || (DETALLE.tipo === 'contrato' && t[0] === 'contratos')));
    return '<button class="tab' + (on ? ' on' : '') + '" onclick="ir(\'' + t[0] + '\')">' + t[1] + (t[0] === 'panel' && nAl ? '<span class="cnt">' + nAl + '</span>' : '') + '</button>';
  }).join('');
  $('vista').innerHTML = '<option value="total">Vista: total</option>' + DB.config.socios.map(function(s){ return '<option value="' + s.id + '"' + (VISTA === s.id ? ' selected' : '') + '>Vista: ' + esc(s.nombre) + '</option>'; }).join('');
  $('vista').value = VISTA;
}
function setVista(v){ VISTA = v; localStorage.setItem('inmoflow_vista', v); renderTodo(); }

function ir(p, det){
  PAGINA = p; DETALLE = det || null;
  document.querySelectorAll('.page').forEach(function(s){ s.classList.remove('on'); });
  $('p-' + p).classList.add('on');
  if (!det) history.replaceState(null, '', '#' + p);
  renderTodo();
  window.scrollTo(0, 0);
}
function verInmueble(id, sub){ ir('detalle', { tipo: 'inmueble', id: id, sub: sub || 'resumen' }); }
function verContrato(id, sub){ ir('detalle', { tipo: 'contrato', id: id, sub: sub || 'cuenta' }); }

function renderTodo(){
  renderTabs();
  var f = {
    panel: renderPanel, inmuebles: renderInmuebles, contratos: renderContratos, pagos: renderPagos,
    gastos: renderGastos, liquidacion: renderLiquidacion, rentabilidad: renderRentabilidad,
    avisos: renderAvisos, ajustes: renderAjustes, detalle: renderDetalle, recibos: renderRecibos
  }[PAGINA];
  if (soloLectura() && PAGINA === 'avisos') { PAGINA = 'panel'; f = renderPanel; }
  if (f) f();
  aplicarSoloLectura($('main'));
}

// ─── modal ───────────────────────────────────
function abrirModal(titulo, cuerpo, pie, ancho){
  $('modal').className = 'modal' + (ancho ? ' wide' : '');
  $('modal').innerHTML = '<div class="mh"><h3>' + titulo + '</h3><button class="btn ghost" onclick="cerrarModal()" aria-label="Cerrar">✕</button></div>' +
    '<div class="mb">' + cuerpo + '</div>' + (pie ? '<div class="mf">' + pie + '</div>' : '');
  $('mbg').classList.add('on');
  aplicarSoloLecturaModal();
  var first = $('modal').querySelector('input.f,select.f,textarea.f');
  if (first && window.innerWidth > 700) setTimeout(function(){ first.focus(); }, 50);
}
function cerrarModal(){ $('mbg').classList.remove('on'); $('modal').innerHTML = ''; }
function val(id){ var e = $(id); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : ''; }
function inp(id, label, v, tipo, extra){
  return '<div><label class="l" for="' + id + '">' + label + '</label><input class="f" id="' + id + '" type="' + (tipo || 'text') + '" value="' + esc(v == null ? '' : v) + '" ' + (extra || '') + '></div>';
}
function sel(id, label, opts, v, extra){
  return '<div><label class="l" for="' + id + '">' + label + '</label><select class="f" id="' + id + '" ' + (extra || '') + '>' +
    opts.map(function(o){ var k = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(k) + '"' + (String(k) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>';
}
function txa(id, label, v){ return '<div><label class="l" for="' + id + '">' + label + '</label><textarea class="f" id="' + id + '">' + esc(v || '') + '</textarea></div>'; }
function confirmar(msg){ return Promise.resolve(window.confirm(msg)); }

function tagEstado(e){
  var m = { pagado: ['t-ok', 'Pagado'], parcial: ['t-warn', 'Parcial'], vencido: ['t-bad', 'Vencido'], pendiente: ['t-mut', 'Pendiente'],
    vigente: ['t-ok', 'Vigente'], finalizado: ['t-mut', 'Finalizado'], rescindido: ['t-mut', 'Rescindido'], futuro: ['t-info', 'Por iniciar'],
    alquilado: ['t-ok', 'Alquilado'], libre: ['t-warn', 'Libre'] }[e] || ['t-mut', e];
  return '<span class="tag ' + m[0] + '">' + m[1] + '</span>';
}
function estadoContrato(c){
  if (c.estado === 'finalizado' || c.estado === 'rescindido') return c.estado;
  if (per(c.inicio) > perHoy()) return 'futuro';
  if (c.fin && c.fin < hoy()) return 'finalizado';
  return 'vigente';
}
function contratoVigenteDe(inmId){
  return vivos('contratos').filter(function(c){ return c.inmuebleId === inmId && estadoContrato(c) === 'vigente'; })[0] || null;
}
function nombreInm(id){ var i = byId('inmuebles', id); return i ? i.nombre : '(sin inmueble)'; }
function etiquetaContrato(c){ return (c.locatario && c.locatario.nombre || 'Sin locatario') + ' — ' + nombreInm(c.inmuebleId); }

// ─── alertas (ajustes, vencimientos, mora) ───
function alertas(){
  var out = [], ph = perHoy(), lim = DB.config.avisoAjusteDias || 30;
  vivos('contratos').forEach(function(c){
    var est = estadoContrato(c);
    if (est !== 'vigente') return;
    var nombre = (c.locatario && c.locatario.nombre) || 'Contrato';
    var pa = proximoAjuste(c);
    if (pa) {
      var dias = diasEntre(hoy(), pa + '-01');
      if (dias <= lim) {
        var aj = calcularAjuste(c, pa);
        out.push({
          nivel: dias < 0 ? 'bad' : 'warn', tipo: 'ajuste', contratoId: c.id, periodo: pa, orden: dias,
          titulo: (dias < 0 ? 'Ajuste pendiente de aplicar: ' : 'Actualiza en ' + perNom(pa) + ': ') + esc(nombre),
          texto: fmt(aj.base) + ' → <b>' + fmt(aj.monto) + '</b> (' + (aj.coef > 1 ? '+' + pct((aj.coef - 1) * 100, 2) : '—') + ', ' + esc(INDICES[c.indice] || c.indice) + ')' + (aj.estimado ? ' <span class="tag t-warn">estimado</span>' : ''),
          acts: '<button class="btn sm p" onclick="modalAjuste(\'' + c.id + '\',\'' + pa + '\')">Aplicar</button><button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'ajuste\')">Avisar</button>'
        });
      }
    }
    if (c.fin) {
      var df = diasEntre(hoy(), c.fin);
      if (df >= 0 && df <= (DB.config.avisoVencimientoDias || 60)) out.push({
        nivel: df <= 30 ? 'bad' : 'warn', tipo: 'vence', contratoId: c.id, orden: df,
        titulo: 'Contrato vence en ' + df + ' días: ' + esc(nombre), texto: 'Fin: ' + fDate(c.fin) + ' — ' + esc(nombreInm(c.inmuebleId)),
        acts: '<button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'vencimiento\')">Avisar</button><button class="btn sm" onclick="verContrato(\'' + c.id + '\',\'datos\')">Ver</button>'
      });
    }
    var deuda = deudaContrato(c);
    if (deuda.length) {
      var tot = sum(deuda, function(f){ return f.debe - f.pagado; });
      out.push({
        nivel: 'bad', tipo: 'mora', contratoId: c.id, orden: -100 - deuda.length,
        titulo: 'Deuda de ' + esc(nombre) + ': ' + fmt(tot),
        texto: deuda.map(function(f){ return perNom(f.periodo) + (f.estado === 'parcial' ? ' (parcial)' : ''); }).join(', '),
        acts: '<button class="btn sm p" onclick="modalPago(null,\'' + c.id + '\')">Cobrar</button><button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'mora\')">Reclamar</button>'
      });
    } else {
      var f0 = cuentaCorriente(c).filas.filter(function(f){ return f.periodo === ph; })[0];
      if (f0 && f0.estado === 'pendiente') out.push({
        nivel: 'info', tipo: 'pendiente', contratoId: c.id, orden: 500,
        titulo: 'A cobrar ' + perNom(ph) + ': ' + esc(nombre), texto: fmt(f0.debe) + ' — vence el ' + fDate(f0.venc),
        acts: '<button class="btn sm p" onclick="modalPago(null,\'' + c.id + '\')">Cobrar</button><button class="btn sm" onclick="modalMensaje(\'' + c.id + '\',\'recordatorio\')">Recordar</button>'
      });
    }
  });
  return out.sort(function(a, b){ return a.orden - b.orden; });
}
function htmlAlerta(a){
  var ic = { bad: '!', warn: '↑', info: '$', ok: '✓' }[a.nivel];
  if (a.tipo === 'vence') ic = '⏱';
  return '<div class="alert ' + a.nivel + '"><div class="ic">' + ic + '</div><div class="tx"><div class="b">' + a.titulo + '</div><div class="small muted">' + a.texto + '</div></div><div class="acts">' + a.acts + '</div></div>';
}

// Notificación del navegador una vez por día si hay ajustes o vencimientos.
function notificarSiCorresponde(){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (localStorage.getItem('inmoflow_notif') === hoy()) return;
  var al = alertas().filter(function(a){ return a.tipo === 'ajuste' || a.tipo === 'vence' || a.tipo === 'mora'; });
  if (!al.length) return;
  localStorage.setItem('inmoflow_notif', hoy());
  var aj = al.filter(function(a){ return a.tipo === 'ajuste'; }).length, mo = al.filter(function(a){ return a.tipo === 'mora'; }).length, ve = al.filter(function(a){ return a.tipo === 'vence'; }).length;
  try { new Notification('InmoFlow', { body: [aj && aj + ' ajuste(s) de alquiler', mo && mo + ' deuda(s)', ve && ve + ' contrato(s) por vencer'].filter(Boolean).join(' · '), icon: 'icon-192.png' }); } catch (e) {}
}

// ─── PANEL ───────────────────────────────────
function renderPanel(){
  var ph = perHoy(), ct = cotizHoy();
  var activos = vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; });
  var inms = vivos('inmuebles');
  var esperadoMes = sum(activos, function(c){ return montoVigente(c, ph) * factor((byId('inmuebles', c.inmuebleId) ? distribucionInm(byId('inmuebles', c.inmuebleId)) : null)); });
  var pagosMes = vivos('pagos').filter(function(p){ return p.periodo === ph; });
  var cobradoMes = sum(pagosMes, function(p){ return num(p.alquiler) * factor(p.distribucion); });
  var netoMes = sum(pagosMes, function(p){ return netoPago(p) * factor(p.distribucion); });
  var gastosMes = sum(vivos('gastos').filter(function(g){ return per(g.fecha) === ph && !g.capital && g.pagadoPor !== 'locatario'; }), function(g){ var i = byId('inmuebles', g.inmuebleId); return num(g.montoARS) * factor(g.distribucion || distribucionInm(i)); });
  var deuda = sum(activos, function(c){ var i = byId('inmuebles', c.inmuebleId); return sum(deudaContrato(c), function(f){ return f.debe - f.pagado; }) * factor(i ? distribucionInm(i) : null); });
  var libres = inms.filter(function(i){ return !contratoVigenteDe(i.id); }).length;
  var al = alertas();
  var serie = serieMensual(12);
  var est = estadoCobroMes(ph);
  var vistaTxt = VISTA === 'total' ? '' : ' · parte de ' + esc(nombreSocio(VISTA));

  $('p-panel').innerHTML =
    '<h2>Panel</h2><p class="sub">' + perNom(ph) + vistaTxt + ' · Dólar oficial ' + (ct.oficial ? fmt(ct.oficial) : '—') + ' · Blue ' + (ct.blue ? fmt(ct.blue) : '—') + '</p>' +
    '<div class="kpis">' +
      kpi('A cobrar este mes', fmt(esperadoMes), activos.length + ' contratos vigentes') +
      kpi('Cobrado', fmt(cobradoMes), esperadoMes ? pct(cobradoMes / esperadoMes * 100, 0) + ' del mes' : '') +
      kpi('Neto propietario', fmt(netoMes), (ct.blue ? '<span class="usd-b">' + fmtU(netoMes / ct.blue) + ' blue</span>' : '') + (ct.oficial ? ' · <span class="usd-o">' + fmtU(netoMes / ct.oficial) + ' of.</span>' : '')) +
      kpi('Gastos del mes', fmt(gastosMes), '') +
      kpi('Deuda de locatarios', fmt(deuda), deuda ? '<span style="color:var(--bad)">a reclamar</span>' : 'al día') +
      kpi('Inmuebles', inms.length, libres ? libres + ' sin contrato vigente' : 'todos alquilados') +
    '</div>' +
    '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" onclick="modalPago()">+ Registrar cobro</button><button class="btn" onclick="ir(\'recibos\')">Recibos</button><button class="btn" onclick="modalGasto()">+ Gasto</button><button class="btn" onclick="modalContrato()">+ Contrato</button><button class="btn" onclick="ir(\'liquidacion\')">Liquidación del mes</button></div>' +
    (inms.length ? '' : '<div class="alert info"><div class="ic">i</div><div class="tx"><b>Empezá cargando tus datos</b><div class="small muted">Podés importar la planilla de alquileres desde Ajustes → Importar, o crear inmuebles y contratos a mano.</div></div><div class="acts"><button class="btn sm p" onclick="ir(\'ajustes\')">Importar</button></div></div>') +
    '<div class="grid g2">' +
      '<div class="card" style="grid-column:1/-1"><div class="card-h"><h3 id="pv-tit"></h3><div class="seg-ctl">' + [['ars', 'Pesos'], ['blue', 'US$ blue'], ['oficial', 'US$ oficial']].map(function(o){ return '<button class="' + (PANEL_MON === o[0] ? 'on' : '') + '" onclick="PANEL_MON=\'' + o[0] + '\';localStorage.setItem(\'inmoflow_pmon\',\'' + o[0] + '\');renderPanel()">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="v-key" id="pv-key"></div><div class="viz" id="pv-chart"></div><div class="hint" id="pv-tot" style="margin-top:6px"></div></div>' +
      '<div class="card"><h3>Estado de cobro — ' + perNom(ph) + '</h3><div class="viz" id="pv-estado"></div>' +
        '<div class="row" style="margin-top:12px"><span class="muted">Cobrado</span><span>' + fmt(est.pagado) + ' de ' + fmt(est.total) + '</span></div></div>' +
      '<div class="card"><h3>Alertas y vencimientos</h3>' + (al.length ? al.slice(0, 14).map(htmlAlerta).join('') + (al.length > 14 ? '<div class="hint">y ' + (al.length - 14) + ' más…</div>' : '') : '<div class="empty">Todo en orden ✓</div>') + '</div>' +
    '</div>';
  graficoPanel(serie);
  vizEstado($('pv-estado'), [
    { label: 'Pagado', icono: '✓', valor: est.pagado, color: 'var(--st-good)', texto: fmt(est.pagado) + ' · ' + est.nPagado },
    { label: 'Parcial', icono: '◐', valor: est.parcial, color: 'var(--st-warn)', texto: fmt(est.parcial) + ' · ' + est.nParcial },
    { label: 'Por vencer', icono: '○', valor: est.pendiente, color: 'var(--v-base)', texto: fmt(est.pendiente) + ' · ' + est.nPendiente },
    { label: 'Vencido', icono: '!', valor: est.vencido, color: 'var(--st-crit)', texto: fmt(est.vencido) + ' · ' + est.nVencido }
  ], est.total);
}
var PANEL_MON = localStorage.getItem('inmoflow_pmon') || 'ars';

// Serie de los últimos n meses, por período del alquiler: cobrado, a cobrar, neto y su valor en US$.
function serieMensual(n){
  var ph = perHoy(), out = [];
  for (var k = n - 1; k >= 0; k--) {
    var mm = perAdd(ph, -k);
    var ps = vivos('pagos').filter(function(p){ return p.periodo === mm; });
    var esperado = sum(vivos('contratos').filter(function(c){
      return per(c.inicio) <= mm && (!c.fin || per(c.fin) >= mm) && (!c.fechaFinReal || per(c.fechaFinReal) >= mm) && c.estado !== 'rescindido';
    }), function(c){ var i = byId('inmuebles', c.inmuebleId); return montoVigente(c, mm) * (i ? factorInm(i) : 1); });
    out.push({
      m: mm, esperado: esperado, n: ps.length,
      cobrado: sum(ps, function(p){ return num(p.alquiler) * factor(p.distribucion); }),
      neto: sum(ps, function(p){ return netoPago(p) * factor(p.distribucion); }),
      blue: sum(ps, function(p){ return usdPago(p, 'blue') * factor(p.distribucion); }),
      oficial: sum(ps, function(p){ return usdPago(p, 'oficial') * factor(p.distribucion); })
    });
  }
  return out;
}
function graficoPanel(serie){
  var ars = PANEL_MON === 'ars';
  $('pv-tit').textContent = ars ? 'Cobrado vs. a cobrar por mes' : 'Neto cobrado en dólar ' + PANEL_MON + ' por mes';
  $('pv-key').innerHTML = ars ? '<span><i style="background:var(--s1)"></i>Cobrado</span><span><i class="l" style="background:var(--s2)"></i>A cobrar (contratos vigentes)</span>' : '';
  var tot = sum(serie, function(s){ return ars ? s.cobrado : s[PANEL_MON]; });
  $('pv-tot').innerHTML = 'Últimos 12 meses: <b>' + (ars ? fmt(tot) : fmtU(tot)) + '</b>' + (ars ? ' cobrados de ' + fmt(sum(serie, function(s){ return s.esperado; })) : ' netos') + ' · tocá una columna para ver la liquidación de ese mes';
  vizColumnas($('pv-chart'), {
    cats: serie.map(function(s){ return s.m; }), etiquetas: serie.map(function(s){ return perCorto(s.m); }),
    barras: { valores: serie.map(function(s){ return ars ? s.cobrado : s[PANEL_MON]; }), color: 'var(--s1)' },
    linea: ars ? { valores: serie.map(function(s){ return s.esperado; }), color: 'var(--s2)' } : null,
    fmtEje: function(v){ return compacto(v, ars ? '$ ' : 'US$ '); }, destacar: serie.length - 1,
    aria: 'Cobros de los últimos 12 meses',
    tip: function(i){
      var s = serie[i];
      return { titulo: perNom(s.m), filas: [
        { v: fmt(s.cobrado), l: 'cobrado', c: ars ? 'var(--s1)' : null },
        { v: fmt(s.esperado), l: 'a cobrar', c: ars ? 'var(--s2)' : null, linea: true },
        { v: fmt(s.neto), l: 'neto propietario' },
        { v: fmtU(s.blue), l: 'neto en blue', c: PANEL_MON === 'blue' ? 'var(--s1)' : null },
        { v: fmtU(s.oficial), l: 'neto en oficial', c: PANEL_MON === 'oficial' ? 'var(--s1)' : null },
        { v: String(s.n), l: s.n === 1 ? 'cobro' : 'cobros' }
      ] };
    },
    click: function(i){ LIQ.per = serie[i].m; ir('liquidacion'); }
  });
}
function estadoCobroMes(p){
  var r = { total: 0, pagado: 0, parcial: 0, parcialPag: 0, pendiente: 0, vencido: 0, nPagado: 0, nParcial: 0, nPendiente: 0, nVencido: 0 };
  vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; }).forEach(function(c){
    var f = cuentaCorriente(c).filas.filter(function(x){ return x.periodo === p; })[0]; if (!f) return;
    var i = byId('inmuebles', c.inmuebleId), fa = i ? factorInm(i) : 1; if (!fa) return;
    r.total += f.debe * fa;
    if (f.estado === 'pagado') { r.pagado += f.debe * fa; r.nPagado++; }
    else if (f.estado === 'parcial') { r.parcial += (f.debe - f.pagado) * fa; r.parcialPag += f.pagado * fa; r.pagado += f.pagado * fa; r.nParcial++; }
    else if (f.estado === 'vencido') { r.vencido += f.debe * fa; r.nVencido++; }
    else { r.pendiente += f.debe * fa; r.nPendiente++; }
  });
  r.nPagado += ' contrato' + (r.nPagado === 1 ? '' : 's'); r.nParcial += ' contr.'; r.nPendiente += ' contr.'; r.nVencido += ' contr.';
  return r;
}
function kpi(l, v, s){ return '<div class="kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (s || '&nbsp;') + '</div></div>'; }
