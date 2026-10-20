// ═══════════════════════════════════════════
// CONTRATOS (carpetas de alquiler)
// ═══════════════════════════════════════════
var FILTRO_CTR = { q: '', est: 'vigente' };

function renderContratos(){
  var lista = vivos('contratos').filter(function(c){
    var i = byId('inmuebles', c.inmuebleId);
    if (VISTA !== 'total' && i && !factorInm(i)) return false;
    var e = estadoContrato(c);
    if (FILTRO_CTR.est !== 'todos' && (FILTRO_CTR.est === 'vigente' ? e !== 'vigente' && e !== 'futuro' : e === 'vigente' || e === 'futuro')) return false;
    var q = FILTRO_CTR.q.toLowerCase();
    return !q || etiquetaContrato(c).toLowerCase().indexOf(q) >= 0 || (c.garantes || []).some(function(g){ return (g.nombre || '').toLowerCase().indexOf(q) >= 0; });
  });
  $('p-contratos').innerHTML = '<h2>Contratos</h2><p class="sub">Cada contrato es la carpeta del alquiler: locatario, garantes, montos, ajustes, cobros, mensajes y documentos.</p>' +
    '<div class="bar"><input class="f grow" placeholder="Buscar locatario, garante o inmueble…" value="' + esc(FILTRO_CTR.q) + '" oninput="FILTRO_CTR.q=this.value;renderContratos();this.focus();this.setSelectionRange(this.value.length,this.value.length)">' +
    '<select class="f" style="width:auto" onchange="FILTRO_CTR.est=this.value;renderContratos()">' + [['vigente', 'Vigentes'], ['fin', 'Finalizados'], ['todos', 'Todos']].map(function(o){ return '<option value="' + o[0] + '"' + (FILTRO_CTR.est === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
    '<button class="btn p" onclick="modalContrato()">+ Contrato</button></div>' + tablaContratos(lista);
}
function tablaContratos(lista){
  if (!lista.length) return '<div class="card empty">No hay contratos.</div>';
  var ph = perHoy();
  lista = lista.slice().sort(function(a, b){ return (a.locatario.nombre || '').localeCompare(b.locatario.nombre || ''); });
  return '<div class="tw"><table><thead><tr><th>Locatario</th><th>Inmueble</th><th class="n">Alquiler</th><th>Índice</th><th>Próx. ajuste</th><th>Vence</th><th>Este mes</th><th class="n">Deuda</th></tr></thead><tbody>' +
    lista.map(function(c){
      var e = estadoContrato(c), cc = cuentaCorriente(c), f = cc.filas.filter(function(x){ return x.periodo === ph; })[0];
      var deuda = sum(deudaContrato(c), function(x){ return x.debe - x.pagado; }), pa = proximoAjuste(c);
      return '<tr class="click" onclick="verContrato(\'' + c.id + '\')"><td><b>' + esc(c.locatario.nombre) + '</b>' + (e !== 'vigente' ? ' ' + tagEstado(e) : '') + '</td><td>' + esc(nombreInm(c.inmuebleId)) + '</td>' +
        '<td class="n">' + fmt(montoVigente(c, ph)) + '</td><td class="small">' + esc(c.indice) + (c.periodicidad ? ' ' + c.periodicidad + 'm' : '') + '</td>' +
        '<td>' + (pa ? (pa <= perAdd(ph, 1) ? '<span class="tag t-warn">' + perNom(pa) + '</span>' : perNom(pa)) : '—') + '</td>' +
        '<td>' + (c.fin ? fDate(c.fin) : '—') + '</td><td>' + (f && e === 'vigente' ? tagEstado(f.estado) : '') + '</td><td class="n" style="color:' + (deuda > 0 ? 'var(--bad)' : 'inherit') + '">' + (deuda > 0 ? fmt(deuda) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function htmlPersona(pref, p, titulo){
  p = p || {};
  return '<div class="fr">' + inp(pref + '-nom', titulo + ' — Nombre y apellido', p.nombre) + inp(pref + '-dni', 'DNI / CUIT', p.dni) + '</div>' +
    '<div class="fr">' + inp(pref + '-tel', 'Celular (WhatsApp)', p.tel, 'tel', 'placeholder="351 555 1234"') + inp(pref + '-mail', 'Email', p.email, 'email') + inp(pref + '-dom', 'Domicilio', p.domicilio) + '</div>';
}
function leerPersona(pref){ return { nombre: val(pref + '-nom'), dni: val(pref + '-dni'), tel: val(pref + '-tel'), email: val(pref + '-mail'), domicilio: val(pref + '-dom') }; }

function modalContrato(id, inmId){
  var c = id ? JSON.parse(JSON.stringify(byId('contratos', id))) : {
    inmuebleId: inmId || '', inicio: hoy(), indice: 'ICL', periodicidad: 4, montos: [], garantes: [{}],
    diaVencimiento: DB.config.diaVencimiento, comisionPct: '', locatario: {}, destino: 'Vivienda'
  };
  if (!c.garantes || !c.garantes.length) c.garantes = [{}];
  var inms = vivos('inmuebles').sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  var monto0 = c.montos && c.montos.length ? montosOrd(c)[0].monto : '';
  var dur = c.inicio && c.fin ? Math.round(perDiff(per(c.inicio), per(addDias(c.fin, 1)))) : 36;
  abrirModal(id ? 'Editar contrato' : 'Nuevo contrato',
    '<div class="fsec">Inmueble y plazo</div>' +
    '<div class="fr">' + sel('k-inm', 'Inmueble *', [['', '— elegir —']].concat(inms.map(function(i){ return [i.id, i.nombre]; })), c.inmuebleId) + sel('k-dest', 'Destino', ['Vivienda', 'Comercial', 'Cochera', 'Temporario', 'Otro'], c.destino) + '</div>' +
    '<div class="fr">' + inp('k-ini', 'Inicio *', c.inicio, 'date', 'onchange="ctrFin()"') + inp('k-dur', 'Duración (meses)', dur, 'number', 'oninput="ctrFin()"') + inp('k-fin', 'Fin', c.fin, 'date') + '</div>' +
    '<div class="fsec">Monto y actualización</div>' +
    '<div class="fr">' + inp('k-monto', 'Monto inicial mensual *', monto0, 'number', 'step="0.01"') + sel('k-idx', 'Índice de actualización', Object.keys(INDICES).map(function(k){ return [k, INDICES[k]]; }), c.indice, 'onchange="ctrIdx()"') + inp('k-per', 'Cada (meses)', c.periodicidad, 'number', 'min="0"') + '</div>' +
    '<div class="fr">' + inp('k-pfijo', '% fijo por ajuste', c.pctFijo, 'number', 'step="0.01"') + inp('k-prim', 'Primer ajuste (si no es inicio + período)', c.primerAjuste, 'month') + sel('k-desf', 'IPC: meses de desfase', [['0', 'Sin desfase'], ['1', '1 mes (habitual)'], ['2', '2 meses']], c.ipcDesfase == null ? 1 : c.ipcDesfase) + '</div>' +
    '<div class="fr">' + inp('k-venc', 'Día de vencimiento del pago', c.diaVencimiento, 'number', 'min="1" max="28"') + inp('k-pun', 'Punitorio diario % (vacío = general)', c.punitorioPct, 'number', 'step="0.01"') + inp('k-com', 'Comisión administrador % (vacío = general ' + DB.config.comisionPct + '%)', c.comisionPct, 'number', 'step="0.01"') + inp('k-dep', 'Depósito en garantía', c.deposito, 'number') + '</div>' +
    '<div class="fsec">Locatario</div>' + htmlPersona('k-loc', c.locatario, 'Locatario') +
    '<div class="fsec">Garantes</div><div id="k-gars">' + c.garantes.map(function(g, n){ return htmlPersona('k-g' + n, g, 'Garante ' + (n + 1)); }).join('') + '</div>' +
    '<button class="btn sm" onclick="ctrAddGarante()">+ Otro garante</button>' +
    '<div style="margin-top:12px">' + txa('k-notas', 'Notas (cláusulas especiales, servicios a cargo, etc.)', c.notas) + '</div>' + lineaAuditoria(id ? c : null),
    (id ? '<button class="btn d" onclick="eliminarContrato(\'' + id + '\')">Eliminar</button><span style="flex:1"></span>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarContrato(\'' + (id || '') + '\')">Guardar</button>', true);
  if (!c.fin) ctrFin();
  ctrIdx();
  $('k-gars').dataset.n = c.garantes.length;
}
function ctrFin(){ var i = val('k-ini'), d = num(val('k-dur')); if (i && d) { var d2 = new Date(i + 'T12:00'); d2.setMonth(d2.getMonth() + d); d2.setDate(d2.getDate() - 1); $('k-fin').value = d2.toISOString().slice(0, 10); } }
function ctrIdx(){ var x = val('k-idx'); $('k-pfijo').parentNode.style.display = x === 'FIJO' ? '' : 'none'; $('k-desf').parentNode.style.display = x === 'IPC' ? '' : 'none'; }
function ctrAddGarante(){ var g = $('k-gars'), n = +g.dataset.n || 1; g.insertAdjacentHTML('beforeend', htmlPersona('k-g' + n, {}, 'Garante ' + (n + 1))); g.dataset.n = n + 1; }
function guardarContrato(id){
  var c = id ? byId('contratos', id) : { montos: [], docs: [] };
  c.inmuebleId = val('k-inm'); if (!c.inmuebleId) { toast('Elegí el inmueble (si no existe, crealo primero en Inmuebles)'); return; }
  c.inicio = val('k-ini'); c.fin = val('k-fin'); if (!c.inicio) { toast('Falta la fecha de inicio'); return; }
  c.destino = val('k-dest'); c.indice = val('k-idx'); c.periodicidad = num(val('k-per')); c.pctFijo = num(val('k-pfijo'));
  c.primerAjuste = val('k-prim') || ''; c.ipcDesfase = num(val('k-desf'));
  c.diaVencimiento = num(val('k-venc')) || DB.config.diaVencimiento; c.punitorioPct = val('k-pun'); c.comisionPct = val('k-com'); c.deposito = num(val('k-dep'));
  c.locatario = leerPersona('k-loc'); if (!c.locatario.nombre) { toast('Falta el nombre del locatario'); return; }
  c.garantes = []; for (var n = 0; n < (+$('k-gars').dataset.n || 1); n++) { var g = leerPersona('k-g' + n); if (g.nombre) c.garantes.push(g); }
  c.notas = val('k-notas');
  var m = num(val('k-monto')); if (!m) { toast('Falta el monto inicial'); return; }
  var ms = montosOrd(c), p0 = per(c.inicio);
  if (!ms.length) c.montos = [{ desde: p0, monto: m, nota: 'Monto inicial' }];
  else { ms[0].monto = m; ms[0].desde = p0; c.montos = ms; } // el monto inicial siempre rige desde el inicio
  c.estado = c.estado || 'vigente';
  guardar('contratos', c); cerrarModal(); toast('Contrato guardado');
  if (!id) verContrato(c.id); else renderTodo();
}
function eliminarContrato(id){
  var n = pagosDe(id).length;
  confirmar('¿Eliminar el contrato?' + (n ? ' Tiene ' + n + ' cobros registrados que se conservarán en el historial del inmueble.' : '')).then(function(ok){ if (ok) { borrar('contratos', id); cerrarModal(); ir('contratos'); } });
}
function finalizarContrato(id){
  var c = byId('contratos', id), f = prompt('Fecha de finalización / entrega de llaves (AAAA-MM-DD):', hoy());
  if (!f) return;
  c.estado = 'finalizado'; c.fechaFinReal = f; guardar('contratos', c); renderTodo(); toast('Contrato finalizado');
}
function reactivarContrato(id){ var c = byId('contratos', id); c.estado = 'vigente'; delete c.fechaFinReal; guardar('contratos', c); renderTodo(); }

// ─── detalle de contrato ─────────────────────
function subCtr(s){ DETALLE.sub = s; renderDetalle(); }
function renderDetContrato(){
  var c = byId('contratos', DETALLE.id); if (!c) return ir('contratos');
  var s = DETALLE.sub, e = estadoContrato(c), ph = perHoy(), h = '';
  var deuda = sum(deudaContrato(c), function(x){ return x.debe - x.pagado; }), pa = proximoAjuste(c);
  h += '<div class="back"><button class="btn sm ghost" onclick="ir(\'contratos\')">← Contratos</button></div>';
  h += '<div class="bar"><div class="grow"><h2>' + esc(c.locatario.nombre) + ' ' + tagEstado(e) + '</h2><div class="sub" style="margin:0"><a href="#" onclick="verInmueble(\'' + c.inmuebleId + '\');return false">' + esc(nombreInm(c.inmuebleId)) + '</a> · ' + fDate(c.inicio) + ' al ' + (c.fin ? fDate(c.fin) : '—') + '</div></div>' +
    '<button class="btn" onclick="modalContrato(\'' + c.id + '\')">Editar</button>' +
    '<button class="btn" onclick="modalMensaje(\'' + c.id + '\')">Mensaje</button>' +
    '<button class="btn p" onclick="modalPago(null,\'' + c.id + '\')">+ Cobro</button></div>';
  h += '<div class="kpis">' + kpi('Alquiler actual', fmt(montoVigente(c, ph)), esc(INDICES[c.indice] || '') + (c.periodicidad ? ' · cada ' + c.periodicidad + ' m' : '')) +
    kpi('Próximo ajuste', pa ? perNom(pa) : '—', pa ? (function(){ var a = calcularAjuste(c, pa); return 'estimado ' + fmt(a.monto) + (a.coef > 1 ? ' (+' + pct((a.coef - 1) * 100) + ')' : ''); })() : '') +
    kpi('Deuda', deuda > 0 ? '<span style="color:var(--bad)">' + fmt(deuda) + '</span>' : 'Al día', '') +
    kpi('Cobrado total', fmt(sum(pagosDe(c.id), totalPago)), pagosDe(c.id).length + ' recibos') + '</div>';
  h += subtabs([['cuenta', 'Cuenta corriente'], ['ajustes', 'Montos y ajustes'], ['datos', 'Partes y datos'], ['mensajes', 'Comunicaciones'], ['docs', 'Documentos']], s, 'subCtr');
  if (s === 'cuenta') h += detCtrCuenta(c);
  if (s === 'ajustes') h += detCtrAjustes(c);
  if (s === 'datos') h += detCtrDatos(c);
  if (s === 'mensajes') h += detCtrMensajes(c);
  if (s === 'docs') h += htmlDocs('contratos', c);
  $('p-detalle').innerHTML = h;
  if (s === 'docs') cargarMiniaturas(c.docs || []);
}
function detCtrCuenta(c){
  var cc = cuentaCorriente(c);
  return '<div class="tw"><table><thead><tr><th>Período</th><th>Vence</th><th class="n">Debe</th><th class="n">Pagado</th><th class="n">Saldo acum.</th><th>Estado</th><th>Recibos</th><th></th></tr></thead><tbody>' +
    cc.filas.slice().reverse().map(function(f){
      return '<tr><td><b>' + perNom(f.periodo) + '</b></td><td>' + fDate(f.venc) + '</td><td class="n">' + fmt(f.debe) + '</td><td class="n">' + fmt(f.pagado) + '</td><td class="n" style="color:' + (f.saldo > 1 ? 'var(--bad)' : 'inherit') + '">' + fmt(f.saldo) + '</td><td>' + tagEstado(f.estado) + '</td>' +
        '<td>' + f.pagos.map(function(p){ return '<button class="btn sm" onclick="reciboPDF(\'' + p.id + '\')" title="' + fDate(p.fecha) + '">N° ' + esc(p.reciboNro || '—') + '</button>'; }).join(' ') + '</td>' +
        '<td>' + (f.estado !== 'pagado' ? '<button class="btn sm p" onclick="modalPago(null,\'' + c.id + '\',\'' + f.periodo + '\')">Cobrar</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function detCtrAjustes(c){
  var ms = montosOrd(c), cal = calendarioAjustes(c), ya = ms.map(function(m){ return m.desde; });
  var prox = cal.filter(function(p){ return ya.indexOf(p) < 0; }).slice(0, 4);
  return '<div class="grid g2"><div class="card"><h3>Historial de montos</h3><div class="tw"><table><thead><tr><th>Desde</th><th class="n">Monto</th><th class="n">Variación</th><th>Detalle</th><th></th></tr></thead><tbody>' +
    ms.map(function(m, k){
      var v = k ? (num(m.monto) / num(ms[k - 1].monto) - 1) * 100 : null;
      return '<tr><td>' + perNom(m.desde) + '</td><td class="n b">' + fmt(m.monto) + '</td><td class="n">' + (v != null ? '+' + pct(v, 2) : '') + '</td><td class="small muted">' + esc(m.nota || '') + '</td><td>' + (k ? '<button class="btn sm ghost" onclick="borrarTramo(\'' + c.id + '\',\'' + m.desde + '\')">✕</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div><div style="margin-top:10px"><button class="btn sm" onclick="modalAjuste(\'' + c.id + '\',null)">+ Cargar monto manual</button></div></div>' +
    '<div class="card"><h3>Próximos ajustes</h3>' + (prox.length ? prox.map(function(p, k){
      if (k) return '<div class="row"><span>' + perNom(p) + '</span><span class="muted small">se calcula al acercarse la fecha</span></div>';
      var a = calcularAjuste(c, p);
      return '<div class="alert ' + (p <= perHoy() ? 'bad' : 'info') + '"><div class="ic">↑</div><div class="tx"><div class="b">' + perNom(p) + '</div><div class="small muted">' + fmt(a.base) + ' → ' + fmt(a.monto) + (a.coef > 1 ? ' (+' + pct((a.coef - 1) * 100, 2) + ')' : '') + (a.estimado ? ' · estimado' : '') + '<br>' + esc(a.detalle) + '</div></div><div class="acts"><button class="btn sm p" onclick="modalAjuste(\'' + c.id + '\',\'' + p + '\')">Aplicar</button><a class="btn sm" target="_blank" rel="noopener" href="' + linkCalendar('Ajuste alquiler ' + c.locatario.nombre, p + '-01', 'Actualizar alquiler de ' + nombreInm(c.inmuebleId) + ' (' + INDICES[c.indice] + ')') + '">Agendar</a></div></div>';
    }).join('') : '<div class="hint">Sin ajustes pendientes.</div>') + '</div></div>';
}
function linkCalendar(titulo, fecha, det){
  var d = fecha.replace(/-/g, ''), d2 = addDias(fecha, 1).replace(/-/g, '');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titulo) + '&dates=' + d + '/' + d2 + '&details=' + encodeURIComponent(det || '');
}
function modalAjuste(cid, p){
  var c = byId('contratos', cid), a = p ? calcularAjuste(c, p) : { base: montoVigente(c, perHoy()), monto: montoVigente(c, perHoy()), coef: 1, detalle: 'Monto cargado manualmente' };
  abrirModal('Actualizar alquiler — ' + esc(c.locatario.nombre),
    '<div class="fr">' + inp('a-desde', 'Vigente desde', p || perHoy(), 'month') + inp('a-monto', 'Nuevo monto', a.monto, 'number', 'step="1"') + '</div>' +
    '<div class="calc"><div class="row"><span>Monto anterior</span><span>' + fmt(a.base) + '</span></div><div class="row"><span>Coeficiente</span><span>' + a.coef.toFixed(4) + '</span></div><div class="small muted" style="margin-top:4px">' + esc(a.detalle) + '</div>' + (a.estimado ? '<div class="tag t-warn" style="margin-top:6px">Algún valor del índice todavía no está publicado: revisá antes de aplicar</div>' : '') + '</div>' +
    '<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="a-avisar" checked> Preparar mensaje al locatario con el nuevo monto</label>',
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="aplicarAjuste(\'' + cid + '\',\'' + esc(a.detalle).replace(/'/g, '') + '\')">Aplicar</button>');
}
function aplicarAjuste(cid, det){
  var c = byId('contratos', cid), d = val('a-desde'), m = num(val('a-monto')), avisar = val('a-avisar');
  if (!d || !m) { toast('Completá período y monto'); return; }
  c.montos = (c.montos || []).filter(function(x){ return x.desde !== d; }).concat([{ desde: d, monto: m, nota: det }]);
  guardar('contratos', c); cerrarModal(); toast('Nuevo monto ' + fmt(m) + ' desde ' + perNom(d));
  renderTodo();
  if (avisar) modalMensaje(cid, 'ajuste');
}
function borrarTramo(cid, d){ var c = byId('contratos', cid); confirmar('¿Quitar el monto vigente desde ' + perNom(d) + '?').then(function(ok){ if (!ok) return; c.montos = c.montos.filter(function(x){ return x.desde !== d; }); guardar('contratos', c); renderTodo(); }); }

function detCtrDatos(c){
  function persona(p, t){
    return '<div class="card"><h3>' + t + '</h3><div class="kv"><div>Nombre</div><div class="b">' + esc(p.nombre) + '</div><div>DNI/CUIT</div><div>' + esc(p.dni || '—') + '</div><div>Celular</div><div>' + (p.tel ? '<a href="' + linkWA(p.tel, '') + '" target="_blank" rel="noopener">' + esc(p.tel) + '</a>' : '—') + '</div><div>Email</div><div>' + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '—') + '</div><div>Domicilio</div><div>' + esc(p.domicilio || '—') + '</div></div></div>';
  }
  var com = c.comisionPct !== '' && c.comisionPct != null ? c.comisionPct : DB.config.comisionPct;
  return '<div class="grid g2">' + persona(c.locatario, 'Locatario') + (c.garantes || []).map(function(g, k){ return persona(g, 'Garante ' + (k + 1)); }).join('') +
    '<div class="card"><h3>Condiciones</h3><div class="kv"><div>Destino</div><div>' + esc(c.destino || '') + '</div><div>Vencimiento</div><div>día ' + (c.diaVencimiento || DB.config.diaVencimiento) + ' de cada mes</div><div>Punitorio</div><div>' + pct(c.punitorioPct !== '' && c.punitorioPct != null ? c.punitorioPct : DB.config.punitorioDiarioPct, 2) + ' diario</div><div>Comisión adm.</div><div>' + pct(com, 2) + '</div><div>Depósito</div><div>' + (c.deposito ? fmt(c.deposito) : '—') + '</div></div>' +
    (c.notas ? '<div class="hint" style="margin-top:8px;white-space:pre-wrap">' + esc(c.notas) + '</div>' : '') +
    '<div style="margin-top:12px">' + (estadoContrato(c) === 'vigente' || estadoContrato(c) === 'futuro' ? '<button class="btn sm" onclick="finalizarContrato(\'' + c.id + '\')">Finalizar contrato</button>' : '<button class="btn sm" onclick="reactivarContrato(\'' + c.id + '\')">Reactivar</button>') + '</div></div></div>';
}
