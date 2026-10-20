// ═══════════════════════════════════════════
// COBROS (pagos de alquiler) y RECIBOS
// ═══════════════════════════════════════════
var FILTRO_PAG = { desde: perAdd(perHoy(), -2), hasta: perHoy(), q: '' };
var MEDIOS = ['Transferencia', 'Efectivo', 'Depósito', 'Cheque', 'Mercado Pago', 'Otro'];

function renderPagos(){
  var lista = vivos('pagos').filter(function(p){
    if (p.periodo < FILTRO_PAG.desde || p.periodo > FILTRO_PAG.hasta) return false;
    if (VISTA !== 'total' && !factor(p.distribucion)) return false;
    var q = FILTRO_PAG.q.toLowerCase(); if (!q) return true;
    var c = byId('contratos', p.contratoId);
    return ((c ? etiquetaContrato(c) : '') + ' ' + (p.reciboNro || '')).toLowerCase().indexOf(q) >= 0;
  });
  $('p-pagos').innerHTML = '<h2>Cobros</h2><p class="sub">Cada cobro calcula solo la comisión, el neto y su equivalente en dólar oficial y blue a la fecha de pago.</p>' +
    '<div class="bar"><input class="f grow" placeholder="Buscar locatario, inmueble o N° de recibo…" value="' + esc(FILTRO_PAG.q) + '" oninput="FILTRO_PAG.q=this.value;renderPagos();this.focus();this.setSelectionRange(this.value.length,this.value.length)">' +
    '<input class="f" style="width:auto" type="month" value="' + FILTRO_PAG.desde + '" onchange="FILTRO_PAG.desde=this.value;renderPagos()"><span class="muted">a</span><input class="f" style="width:auto" type="month" value="' + FILTRO_PAG.hasta + '" onchange="FILTRO_PAG.hasta=this.value;renderPagos()">' +
    '<button class="btn" onclick="exportarExcel(\'pagos\')">Excel</button><button class="btn p" onclick="modalPago()">+ Registrar cobro</button></div>' + tablaPagos(lista);
}
function tablaPagos(lista){
  if (!lista.length) return '<div class="card empty">No hay cobros en este rango.</div>';
  lista = lista.slice().sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; });
  var T = { tot: 0, com: 0, net: 0, of: 0, bl: 0 };
  var rows = lista.map(function(p){
    var c = byId('contratos', p.contratoId), f = factor(p.distribucion);
    var t = totalPago(p) * f, co = num(p.comision) * f, n = netoPago(p) * f, of = usdPago(p, 'oficial') * f, bl = usdPago(p, 'blue') * f;
    T.tot += t; T.com += co; T.net += n; T.of += of; T.bl += bl;
    return '<tr class="click" onclick="modalPago(\'' + p.id + '\')"><td>' + fDate(p.fecha) + '</td><td>' + perNom(p.periodo) + '</td><td><b>' + esc(c ? c.locatario.nombre : '—') + '</b><div class="small muted">' + esc(nombreInm(p.inmuebleId)) + '</div></td>' +
      '<td class="n">' + fmt(t) + '</td><td class="n">' + fmt(co) + '</td><td class="n b">' + fmt(n) + '</td><td class="n usd-o">' + fmtU(of) + '</td><td class="n usd-b">' + fmtU(bl) + '</td>' +
      '<td onclick="event.stopPropagation()"><button class="btn sm" onclick="reciboPDF(\'' + p.id + '\')">Recibo ' + esc(p.reciboNro || '') + '</button></td></tr>';
  }).join('');
  return '<div class="tw"><table><thead><tr><th>Fecha</th><th>Período</th><th>Locatario / inmueble</th><th class="n">Cobrado</th><th class="n">Comisión</th><th class="n">Neto</th><th class="n">US$ oficial</th><th class="n">US$ blue</th><th></th></tr></thead><tbody>' + rows +
    '</tbody><tfoot><tr><td colspan="3">Total (' + lista.length + ')</td><td class="n">' + fmt(T.tot) + '</td><td class="n">' + fmt(T.com) + '</td><td class="n">' + fmt(T.net) + '</td><td class="n usd-o">' + fmtU(T.of) + '</td><td class="n usd-b">' + fmtU(T.bl) + '</td><td></td></tr></tfoot></table></div>';
}

function primerPeriodoImpago(c){
  var cc = cuentaCorriente(c), f = cc.filas.filter(function(x){ return x.estado !== 'pagado'; })[0];
  return f ? f.periodo : perAdd(cc.filas.length ? cc.filas[cc.filas.length - 1].periodo : perHoy(), cc.filas.length ? 1 : 0);
}
function comisionPctDe(c){ return c && c.comisionPct !== '' && c.comisionPct != null ? num(c.comisionPct) : num(DB.config.comisionPct); }

var _pagoExtras = [];
function modalPago(id, contratoId, periodo){
  var p = id ? JSON.parse(JSON.stringify(byId('pagos', id))) : null;
  var ctrs = vivos('contratos').filter(function(c){ return estadoContrato(c) !== 'finalizado' || c.id === contratoId || (p && c.id === p.contratoId); })
    .sort(function(a, b){ return etiquetaContrato(a).localeCompare(etiquetaContrato(b)); });
  if (!ctrs.length) { toast('Primero cargá un contrato'); return; }
  var c = byId('contratos', p ? p.contratoId : (contratoId || ctrs[0].id));
  if (!p) {
    var per0 = periodo || primerPeriodoImpago(c);
    var fila = cuentaCorriente(c).filas.filter(function(f){ return f.periodo === per0; })[0];
    // por defecto, el mismo receptor y medio que el último cobro de este contrato
    var ult = pagosDe(c.id).filter(function(x){ return x.medio !== 'Planilla'; }).sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; })[0];
    p = { contratoId: c.id, periodo: per0, fecha: hoy(), alquiler: fila ? Math.max(0, fila.debe - fila.pagado) : montoVigente(c, per0), punitorios: 0, extras: [], descuento: 0, medio: ult ? ult.medio : 'Transferencia', comisionPct: comisionPctDe(c),
      recibio: ult && ult.recibio && ult.recibio.length === 1 ? [{ quien: ult.recibio[0].quien, monto: 0 }] : null };
  }
  _pagoExtras = (p.extras || []).slice();
  var rec = p.recibio && p.recibio.length ? p.recibio : [{ quien: DB.config.receptorDefault || 'admin', monto: 0 }];
  var recSel = rec.length > 1 ? 'split' : rec[0].quien;
  abrirModal(id ? 'Cobro — recibo N° ' + esc(p.reciboNro || '') : 'Registrar cobro',
    '<div class="fr">' + sel('g-ctr', 'Contrato', ctrs.map(function(x){ return [x.id, etiquetaContrato(x)]; }), c.id, 'onchange="pagoCambiaContrato()"') + '</div>' +
    '<div class="fr">' + inp('g-per', 'Período que paga', p.periodo, 'month', 'onchange="pagoCambiaPeriodo()"') + inp('g-fecha', 'Fecha de pago', p.fecha, 'date', 'onchange="pagoCotiz();pagoCalc()"') + sel('g-medio', 'Medio', MEDIOS, p.medio) + '</div>' +
    '<div class="fr">' + sel('g-recq', '¿Quién recibió el dinero?', receptores().concat([['split', 'Dividido entre varios…']]), recSel, 'onchange="pagoRecep()"') + '</div>' +
    '<div class="fr" id="g-split" style="display:none">' + receptores().map(function(r){ var x = rec.filter(function(y){ return y.quien === r[0]; })[0]; return inp('g-rm-' + r[0], r[1], x && rec.length > 1 ? x.monto : '', 'number', 'step="0.01" oninput="pagoCalc()"'); }).join('') + '</div>' +
    '<div class="fr">' + inp('g-alq', 'Alquiler', p.alquiler, 'number', 'step="0.01" oninput="pagoCalc()"') + '<div><label class="l" for="g-pun">Punitorios <a href="#" onclick="pagoPunitorio();return false">calcular</a></label><input class="f" id="g-pun" type="number" step="0.01" value="' + esc(p.punitorios || 0) + '" oninput="pagoCalc()"></div>' + inp('g-desc', 'Descuento / bonificación', p.descuento || 0, 'number', 'step="0.01" oninput="pagoCalc()"') + '</div>' +
    '<label class="l">Otros conceptos (expensas, servicios, tasas…)</label><div class="lines" id="g-extras"></div><button class="btn sm" onclick="_pagoExtras.push({concepto:\'\',monto:0,tipo:\'reintegro\'});pagoExtrasRender()">+ Concepto</button>' +
    '<div class="fr" style="margin-top:12px">' + inp('g-com', 'Comisión administrador %', p.comisionPct, 'number', 'step="0.01" oninput="pagoCalc()"') + inp('g-cof', 'Dólar oficial (venta) del día', p.cotOf || '', 'number', 'step="0.01" oninput="pagoCalc()"') + inp('g-cbl', 'Dólar blue (venta) del día', p.cotBl || '', 'number', 'step="0.01" oninput="pagoCalc()"') + '</div>' +
    '<div class="calc" id="g-calc"></div>' +
    '<div style="margin-top:10px">' + inp('g-nota', 'Nota (sale en el recibo)', p.nota) + '</div>' + lineaAuditoria(id ? p : null),
    (id ? '<button class="btn d" onclick="eliminarPago(\'' + id + '\')">Eliminar</button><span style="flex:1"></span><button class="btn" onclick="reciboPDF(\'' + id + '\')">Recibo PDF</button>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarPago(\'' + (id || '') + '\')">' + (id ? 'Guardar' : 'Guardar y emitir recibo') + '</button>', true);
  pagoExtrasRender();
  if (!p.cotOf) pagoCotiz();
  pagoRecep();
}
// Receptores posibles del dinero: la administración (caja) o cualquiera de los socios.
function receptores(){ return [['admin', 'Administración (' + (DB.config.administrador || 'caja') + ')']].concat(DB.config.socios.map(function(s){ return [s.id, s.nombre]; })); }
function nombreReceptor(q){ return q === 'admin' ? (DB.config.administrador || 'Administración') : nombreSocio(q); }
function recibioDe(p){ return p.recibio && p.recibio.length ? p.recibio : [{ quien: 'admin', monto: totalPago(p) }]; }
function pagoRecep(){ $('g-split').style.display = val('g-recq') === 'split' ? '' : 'none'; pagoCalc(); }
function pagoExtrasRender(){
  $('g-extras').innerHTML = _pagoExtras.map(function(e, k){
    return '<div class="ln" style="grid-template-columns:1fr 120px 130px 32px"><input class="f" placeholder="Concepto" value="' + esc(e.concepto) + '" oninput="_pagoExtras[' + k + '].concepto=this.value">' +
      '<input class="f" type="number" step="0.01" value="' + esc(e.monto) + '" oninput="_pagoExtras[' + k + '].monto=num(this.value);pagoCalc()">' +
      '<select class="f" onchange="_pagoExtras[' + k + '].tipo=this.value;pagoCalc()" title="¿Es renta del propietario o un reintegro de algo que se paga a terceros?"><option value="reintegro"' + (e.tipo !== 'ingreso' ? ' selected' : '') + '>Reintegro</option><option value="ingreso"' + (e.tipo === 'ingreso' ? ' selected' : '') + '>Ingreso</option></select>' +
      '<button class="btn sm ghost" onclick="_pagoExtras.splice(' + k + ',1);pagoExtrasRender();pagoCalc()">✕</button></div>';
  }).join('');
}
function pagoCambiaContrato(){
  var c = byId('contratos', val('g-ctr')); $('g-per').value = primerPeriodoImpago(c); $('g-com').value = comisionPctDe(c); pagoCambiaPeriodo();
}
function pagoCambiaPeriodo(){
  var c = byId('contratos', val('g-ctr')), pp = val('g-per');
  var f = cuentaCorriente(c).filas.filter(function(x){ return x.periodo === pp; })[0];
  $('g-alq').value = f ? Math.max(0, f.debe - f.pagado) : montoVigente(c, pp);
  $('g-pun').value = 0; pagoCalc();
}
function pagoCotiz(){ var f = val('g-fecha'); $('g-cof').value = cotiz('oficial', f) || ''; $('g-cbl').value = cotiz('blue', f) || ''; }
function pagoPunitorio(){
  var c = byId('contratos', val('g-ctr')), r = punitorioSugerido(c, val('g-per'), val('g-fecha'), num(val('g-alq')));
  $('g-pun').value = r.monto; pagoCalc();
  toast(r.dias ? r.dias + ' días de mora' : 'Pagó en término: sin punitorios');
}
function pagoLeer(){
  var c = byId('contratos', val('g-ctr')), i = byId('inmuebles', c.inmuebleId);
  var p = {
    contratoId: c.id, inmuebleId: c.inmuebleId, periodo: val('g-per'), fecha: val('g-fecha'), medio: val('g-medio'),
    alquiler: num(val('g-alq')), punitorios: num(val('g-pun')), descuento: num(val('g-desc')),
    extras: _pagoExtras.filter(function(e){ return e.concepto || e.monto; }).map(function(e){ return { concepto: e.concepto || 'Otro', monto: num(e.monto), tipo: e.tipo || 'reintegro' }; }),
    comisionPct: num(val('g-com')), cotOf: num(val('g-cof')), cotBl: num(val('g-cbl')), nota: val('g-nota'),
    distribucion: distribucionInm(i).map(function(t){ return { socioId: t.socioId, pct: t.pct }; })
  };
  var base = DB.config.comisionBase === 'total' ? ingresoPago(p) - p.descuento : p.alquiler - p.descuento;
  p.comision = r2(Math.max(0, base) * p.comisionPct / 100);
  var q = val('g-recq');
  p.recibio = q === 'split'
    ? receptores().map(function(r){ return { quien: r[0], monto: num(val('g-rm-' + r[0])) }; }).filter(function(r){ return r.monto; })
    : [{ quien: q || 'admin', monto: totalPago(p) }];
  return p;
}
function pagoCalc(){
  if (!$('g-calc')) return;
  var p = pagoLeer(), n = netoPago(p), reint = sum(p.extras.filter(function(e){ return e.tipo === 'reintegro'; }), function(e){ return e.monto; });
  $('g-calc').innerHTML =
    '<div class="row"><span>Total que paga el locatario</span><span>' + fmt2(totalPago(p)) + '</span></div>' +
    (reint ? '<div class="row"><span class="muted">− Reintegros (no son renta)</span><span>' + fmt2(reint) + '</span></div>' : '') +
    '<div class="row"><span class="muted">− Comisión administrador (' + pct(p.comisionPct, 2) + ')</span><span>' + fmt2(p.comision) + '</span></div>' +
    '<div class="row" style="border-top:1px solid var(--line);margin-top:4px;padding-top:6px"><span class="b">Neto propietario(s)</span><span>' + fmt2(n) + '</span></div>' +
    '<div class="row"><span>Equivale en dólar oficial</span><span class="usd-o">' + (p.cotOf ? fmtU2(n / p.cotOf) : '—') + '</span></div>' +
    '<div class="row"><span>Equivale en dólar blue</span><span class="usd-b">' + (p.cotBl ? fmtU2(n / p.cotBl) : '—') + '</span></div>' +
    (p.distribucion.length > 1 ? '<div class="small muted" style="margin-top:6px">Le corresponde a ' + p.distribucion.map(function(d){ return esc(nombreSocio(d.socioId)) + ' (' + d.pct + '%): <b>' + fmt(n * d.pct / 100) + '</b>'; }).join(' · ') + '</div>' : '') +
    (function(){
      var tr = sum(p.recibio, function(r){ return r.monto; }), dif = totalPago(p) - tr;
      var txt = 'Recibió el dinero: ' + p.recibio.map(function(r){ return esc(nombreReceptor(r.quien)) + ' ' + fmt(r.monto); }).join(' · ');
      return '<div class="small" style="margin-top:6px">' + txt + (Math.abs(dif) > 1 ? ' <span class="tag t-bad">faltan asignar ' + fmt(dif) + '</span>' : '') + '</div>';
    })();
}
function guardarPago(id){
  var p = pagoLeer();
  var difRec = totalPago(p) - sum(p.recibio, function(r){ return r.monto; });
  if (Math.abs(difRec) > 1) { toast('Lo recibido por cada uno (' + fmt(totalPago(p) - difRec) + ') no coincide con el total ' + fmt(totalPago(p))); return; }
  if (!p.periodo || !p.fecha) { toast('Completá período y fecha'); return; }
  if (!p.alquiler && !p.extras.length && !p.punitorios) { toast('Ingresá el monto cobrado'); return; }
  if (id) { var old = byId('pagos', id); p.id = id; p.reciboNro = old.reciboNro; p.creado = old.creado; }
  else {
    var dup = pagosDe(p.contratoId).filter(function(x){ return x.periodo === p.periodo; });
    var fila = cuentaCorriente(byId('contratos', p.contratoId)).filas.filter(function(f){ return f.periodo === p.periodo; })[0];
    if (dup.length && fila && fila.estado === 'pagado' && !window.confirm(perNom(p.periodo) + ' ya figura pagado. ¿Registrar otro cobro igual?')) return;
    p.reciboNro = DB.config.reciboPuntoVenta + '-' + String(DB.config.reciboNro).padStart(8, '0');
    DB.config.reciboNro++; guardarConfig();
  }
  guardar('pagos', p); cerrarModal(); renderTodo();
  toast('Cobro registrado — recibo ' + p.reciboNro);
  if (!id) reciboPDF(p.id, true);
}
function eliminarPago(id){ confirmar('¿Eliminar este cobro? El número de recibo no se reutiliza.').then(function(ok){ if (ok) { borrar('pagos', id); cerrarModal(); renderTodo(); } }); }

