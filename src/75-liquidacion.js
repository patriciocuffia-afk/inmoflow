// ═══════════════════════════════════════════
// LIQUIDACIÓN / RENDICIÓN MENSUAL POR SOCIO (como la planilla de la administradora)
//   Alquileres que le corresponden  − comisión administración  − su parte de los gastos
//   − lo que cobró él directamente  + gastos que adelantó  ± retiros, transferencias y ajustes
//   = NETO A COBRAR (positivo: se lo debe la administración; negativo: tiene de más)
// ═══════════════════════════════════════════
var LIQ = { per: perHoy(), modo: 'periodo' }; // modo: 'periodo' (mes que paga) | 'cobro' (fecha de cobro)
var TIPOS_MOV = [
  ['retiro', 'Retiro en efectivo (la administración le entrega)'],
  ['transferencia', 'Transferencia de la administración al socio'],
  ['aporte', 'Aporte del socio a la caja'],
  ['entre', 'Pago entre socios'],
  ['ajuste', 'Ajuste manual (+ a favor / − en contra)']
];

function cobrosDelMes(p){ return vivos('pagos').filter(function(x){ return LIQ.modo === 'cobro' ? per(x.fecha) === p : x.periodo === p; }); }
// Parte de lo recibido que es renta (lo que se paga a terceros —reintegros— queda fuera de la rendición).
function fraccionRenta(x){ var t = totalPago(x); return t > 0 ? (ingresoPago(x) - num(x.descuento)) / t : 0; }
function gastoEnRendicion(g){ return g.pagadoPor === 'admin' || String(g.pagadoPor).indexOf('socio:') === 0; }

function rendicion(p, socioId, conSaldo){
  var R = { alq: [], gastos: [], movs: [], totalAlq: 0, com: 0, totalGas: 0, totalMov: 0, saldoAnt: 0 };
  cobrosDelMes(p).forEach(function(x){
    var c = byId('contratos', x.contratoId), loc = c ? c.locatario.nombre : '—';
    var d = (x.distribucion || []).find(function(t){ return t.socioId === socioId; }), f = d ? num(d.pct) / 100 : 0;
    var recibio = recibioDe(x), fr = fraccionRenta(x);
    if (f) {
      var otros = recibio.filter(function(r){ return r.quien !== 'admin'; }).map(function(r){ return nombreReceptor(r.quien); });
      R.alq.push({ pago: x, loc: loc, inm: nombreInm(x.inmuebleId), pct: d.pct, monto: (ingresoPago(x) - num(x.descuento)) * f, com: num(x.comision) * f, recibio: otros });
    }
    recibio.forEach(function(r){
      if (r.quien === socioId && r.monto) R.movs.push({ tipo: 'cobro', txt: 'Cobró directo ' + titulo(loc) + (f < 1 ? ' (total, le toca ' + r2(f * 100) + '%)' : ''), monto: -r.monto * fr, pago: x });
    });
  });
  vivos('gastos').forEach(function(g){
    if (per(g.fecha) !== p || !gastoEnRendicion(g)) return;
    var d = (g.distribucion || distribucionInm(byId('inmuebles', g.inmuebleId))).find(function(t){ return t.socioId === socioId; });
    if (d && num(d.pct)) R.gastos.push({ gasto: g, txt: (g.descripcion || g.categoria) + ' — ' + nombreInm(g.inmuebleId) + (num(d.pct) < 100 ? ' (' + r2(d.pct) + '%)' : ''), monto: num(g.montoARS) * num(d.pct) / 100 });
    if (g.pagadoPor === 'socio:' + socioId) R.movs.push({ tipo: 'pagoGasto', txt: 'Pagó ' + (g.descripcion || g.categoria) + ' (se le reintegra)', monto: num(g.montoARS), gasto: g });
  });
  vivos('movimientos').forEach(function(m){
    if (per(m.fecha) !== p) return;
    var v = 0;
    if (m.socioId === socioId) v = m.tipo === 'retiro' || m.tipo === 'transferencia' ? -num(m.monto) : m.tipo === 'aporte' || m.tipo === 'entre' ? num(m.monto) : num(m.monto);
    else if (m.tipo === 'entre' && m.destinoId === socioId) v = -num(m.monto);
    if (v) R.movs.push({ tipo: 'mov', txt: textoMov(m, socioId), monto: v, mov: m });
  });
  R.alq.sort(function(a, b){ return a.loc.localeCompare(b.loc); });
  R.totalAlq = sum(R.alq, function(a){ return a.monto; });
  R.com = sum(R.alq, function(a){ return a.com; });
  R.totalGas = sum(R.gastos, function(g){ return g.monto; });
  R.totalMov = sum(R.movs, function(m){ return m.monto; });
  R.netoMes = R.totalAlq - R.com - R.totalGas + R.totalMov;
  var desde = DB.config.rendicionDesde;
  if (conSaldo && desde && desde < p) { for (var m = desde; m < p; m = perAdd(m, 1)) R.saldoAnt += rendicion(m, socioId, false).netoMes; }
  R.neto = R.netoMes + R.saldoAnt;
  return R;
}
function textoMov(m, socioId){
  var t = { retiro: 'Retiro en efectivo', transferencia: 'Transferencia de la administración', aporte: 'Aporte a la caja', ajuste: 'Ajuste' }[m.tipo];
  if (m.tipo === 'entre') t = m.socioId === socioId ? 'Le pagó a ' + nombreSocio(m.destinoId) : 'Recibió de ' + nombreSocio(m.socioId);
  return t + (m.concepto ? ' — ' + m.concepto : '') + ' (' + fDate(m.fecha) + ')';
}
// Caja de la administración en el mes: lo que entró a la administración menos lo que salió.
function cajaAdmin(p){
  var rec = sum(cobrosDelMes(p), function(x){ return sum(recibioDe(x).filter(function(r){ return r.quien === 'admin'; }), function(r){ return r.monto; }) * fraccionRenta(x); });
  var gas = sum(vivos('gastos').filter(function(g){ return per(g.fecha) === p && g.pagadoPor === 'admin'; }), function(g){ return g.montoARS; });
  var ms = vivos('movimientos').filter(function(m){ return per(m.fecha) === p; });
  var sal = sum(ms.filter(function(m){ return m.tipo === 'retiro' || m.tipo === 'transferencia'; }), function(m){ return m.monto; });
  var apo = sum(ms.filter(function(m){ return m.tipo === 'aporte'; }), function(m){ return m.monto; });
  var com = sum(cobrosDelMes(p), function(x){ return x.comision; });
  return { rec: rec, gas: gas, sal: sal, apo: apo, com: com, saldo: rec - gas - sal + apo - com };
}

function renderLiquidacion(){
  var p = LIQ.per, socios = DB.config.socios.filter(function(s){ return VISTA === 'total' || VISTA === s.id; });
  var Rs = socios.map(function(s){ return { s: s, R: rendicion(p, s.id, true) }; });
  var caja = cajaAdmin(p);
  var pend = vivos('contratos').filter(function(c){ return estadoContrato(c) === 'vigente'; }).map(function(c){
    var f = cuentaCorriente(c).filas.filter(function(x){ return x.periodo === p; })[0]; return f && f.estado !== 'pagado' ? { c: c, f: f } : null;
  }).filter(Boolean);
  var h = '<h2>Liquidación de alquileres</h2><p class="sub">Igual que la planilla: lo que le toca a cada dueño, la comisión de ' + esc(DB.config.administrador || 'la administración') + ', lo que cada uno ya cobró o retiró, y el neto a cobrar.</p>' +
    '<div class="bar"><button class="btn" onclick="LIQ.per=perAdd(LIQ.per,-1);renderLiquidacion()" aria-label="Mes anterior">‹</button><input class="f" style="width:auto" type="month" value="' + p + '" onchange="LIQ.per=this.value;renderLiquidacion()"><button class="btn" onclick="LIQ.per=perAdd(LIQ.per,1);renderLiquidacion()" aria-label="Mes siguiente">›</button>' +
    '<select class="f" style="width:auto" onchange="LIQ.modo=this.value;renderLiquidacion()"><option value="periodo"' + (LIQ.modo === 'periodo' ? ' selected' : '') + '>Por período del alquiler</option><option value="cobro"' + (LIQ.modo === 'cobro' ? ' selected' : '') + '>Por fecha de cobro</option></select>' +
    '<span class="grow"></span><button class="btn p" onclick="modalMovimiento()">+ Retiro / transferencia</button><button class="btn" onclick="liquidacionPDF()">PDF</button><button class="btn" onclick="liquidacionTexto()">WhatsApp</button><button class="btn" onclick="liquidacionExcel()">Excel</button></div>';
  h += '<div class="kpis">' + Rs.map(function(x){
      return kpi('Neto a cobrar ' + esc(x.s.nombre), '<span class="' + (x.R.neto < -1 ? 'neg-v' : '') + '">' + fmt(x.R.neto) + '</span>', x.R.neto < -1 ? 'tiene de más: debe reintegrar' : 'le debe la administración');
    }).join('') +
    kpi('Comisión ' + esc(DB.config.administrador || ''), fmt(caja.com), pct(DB.config.comisionPct, 2) + ' de lo cobrado') +
    (esAdmin() ? kpi('Caja administración', fmt(caja.saldo), 'entró ' + fmt(caja.rec + caja.apo) + ' · salió ' + fmt(caja.gas + caja.sal)) : '') +
    kpi('Pendientes de cobro', pend.length, pend.length ? fmt(sum(pend, function(x){ return x.f.debe - x.f.pagado; })) : 'todo cobrado') + '</div>';
  h += '<div class="grid g2">' + Rs.map(function(x){ return htmlRendicion(x.s, x.R, p); }).join('') + '</div>';
  h += htmlControlCobros(p, pend);
  if (esAdmin()) h += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Caja de la administración — ' + perNom(p) + '</h3></div>' +
    '<div class="row"><span>Cobros recibidos por la administración</span><span>' + fmt(caja.rec) + '</span></div>' +
    (caja.apo ? '<div class="row"><span>Aportes de socios</span><span>' + fmt(caja.apo) + '</span></div>' : '') +
    '<div class="row"><span class="muted">− Gastos pagados con la caja</span><span>' + fmt(caja.gas) + '</span></div>' +
    '<div class="row"><span class="muted">− Retiros y transferencias a socios</span><span>' + fmt(caja.sal) + '</span></div>' +
    '<div class="row"><span class="muted">− Comisión ' + esc(DB.config.administrador || '') + '</span><span>' + fmt(caja.com) + '</span></div>' +
    '<div class="liq-tot"><span>Queda en caja (a rendir)</span><span>' + fmt(caja.saldo) + '</span></div>' +
    '<div class="hint">Debe coincidir con la suma de los “neto a cobrar” del mes de los socios. Si no, falta registrar algún retiro o quién recibió algún cobro.</div>' +
    '<div class="fr" style="margin-top:12px;max-width:420px"><div><label class="l" for="liq-desde">Arrastrar saldos entre meses desde</label><input class="f" type="month" id="liq-desde" value="' + esc(DB.config.rendicionDesde || '') + '" onchange="DB.config.rendicionDesde=this.value;guardarConfig();renderLiquidacion()"></div></div>' +
    '<div class="hint">Vacío = cada mes se liquida por separado, como la planilla. Con un mes cargado, lo que no se rindió pasa al mes siguiente como “saldo anterior”.</div></div>';
  $('p-liquidacion').innerHTML = h;
}
function htmlRendicion(s, R, p){
  function fila(txt, v, extra, onclick){ return '<div class="row' + (onclick ? ' click" style="cursor:pointer" onclick="' + onclick : '') + '"><span>' + txt + (extra || '') + '</span><span class="' + (v < 0 ? 'neg-v' : '') + '">' + (v < 0 ? '− ' + fmt(-v) : fmt(v)) + '</span></div>'; }
  return '<div class="card liq-col"><h3><span>' + esc(s.nombre.toUpperCase()) + '</span><span class="small muted">' + perNom(p) + '</span></h3>' +
    '<div class="liq-sec">Alquileres</div>' +
    (R.alq.length ? R.alq.map(function(a){
      return fila(esc(a.loc) + (a.pct < 100 ? ' <span class="muted small">' + r2(a.pct) + '%</span>' : ''), a.monto, a.recibio.length ? ' <span class="tag t-info" title="Quién recibió el dinero">→ ' + esc(a.recibio.join(', ')) + '</span>' : '', 'modalPago(\'' + a.pago.id + '\')');
    }).join('') : '<div class="hint">Sin cobros en el mes.</div>') +
    '<div class="liq-tot"><span>TOTAL NETO ALQUILERES</span><span>' + fmt(R.totalAlq) + '</span></div>' +
    fila('Comisión ' + esc(DB.config.administrador || 'administración') + ' ' + pct(DB.config.comisionPct, 2), -R.com) +
    (R.gastos.length ? '<div class="liq-sec">Gastos</div>' + R.gastos.map(function(g){ return fila(esc(g.txt), -g.monto, '', 'modalGasto(\'' + g.gasto.id + '\')'); }).join('') : '') +
    (R.movs.length ? '<div class="liq-sec">Retiros / transferencias</div>' + R.movs.map(function(m){
      var oc = m.pago ? 'modalPago(\'' + m.pago.id + '\')' : m.gasto ? 'modalGasto(\'' + m.gasto.id + '\')' : 'modalMovimiento(\'' + m.mov.id + '\')';
      return fila(esc(m.txt), m.monto, '', oc);
    }).join('') : '') +
    (R.saldoAnt ? fila('Saldo de meses anteriores', R.saldoAnt) : '') +
    '<div class="liq-final' + (R.neto < -1 ? ' neg' : '') + '"><span>NETO A COBRAR</span><span>' + fmt(R.neto) + '</span></div>' +
    '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" onclick="modalMovimiento(null,\'' + s.id + '\',\'retiro\')">Registrar retiro</button><button class="btn sm" onclick="modalMovimiento(null,\'' + s.id + '\',\'transferencia\',' + Math.max(0, Math.round(R.neto)) + ')">Rendir saldo</button></div>' +
  '</div>';
}
// Control rápido de cada cobro del mes: quién recibió la plata (se cambia en el momento).
function htmlControlCobros(p, pend){
  var cs = cobrosDelMes(p).filter(function(x){ return VISTA === 'total' || factor(x.distribucion); }).sort(function(a, b){
    var ca = byId('contratos', a.contratoId), cb = byId('contratos', b.contratoId);
    return ((ca && ca.locatario.nombre) || '').localeCompare((cb && cb.locatario.nombre) || '');
  });
  var opts = receptores();
  return '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Control de cobros — ' + perNom(p) + '</h3><span class="small muted">Cambiá quién recibió cada pago y la liquidación se recalcula sola</span></div>' +
    '<div class="tw"><table><thead><tr><th>Locatario</th><th>Dueños</th><th class="n">Cobrado</th><th>¿Quién lo recibió?</th><th>Medio</th><th>Recibo</th></tr></thead><tbody>' +
    (cs.length ? cs.map(function(x){
      var c = byId('contratos', x.contratoId), rec = recibioDe(x);
      var duenos = (x.distribucion || []).map(function(d){ return esc(nombreSocio(d.socioId).split(' ').slice(-1)[0]) + (d.pct < 100 ? ' ' + r2(d.pct) + '%' : ''); }).join(' / ');
      var celda = rec.length > 1 ? '<button class="btn sm" onclick="modalPago(\'' + x.id + '\')">Dividido: ' + esc(rec.map(function(r){ return nombreReceptor(r.quien).split(' ').slice(-1)[0] + ' ' + compacto(r.monto, '$'); }).join(' · ')) + '</button>'
        : '<select class="recep" onchange="setRecibio(\'' + x.id + '\',this.value)" aria-label="Quién recibió el cobro">' + opts.map(function(o){ return '<option value="' + o[0] + '"' + (rec[0].quien === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      return '<tr><td><b>' + esc(c ? c.locatario.nombre : '—') + '</b><div class="small muted">' + esc(nombreInm(x.inmuebleId)) + '</div></td><td class="small">' + duenos + '</td><td class="n b">' + fmt(totalPago(x)) + '</td><td>' + celda + '</td>' +
        '<td><select class="recep" onchange="setMedio(\'' + x.id + '\',this.value)">' + MEDIOS.concat(x.medio && MEDIOS.indexOf(x.medio) < 0 ? [x.medio] : []).map(function(m){ return '<option' + (x.medio === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select></td>' +
        '<td><button class="btn sm" onclick="verRecibo(\'' + x.id + '\')">' + esc(x.reciboNro || 'Ver') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">Sin cobros registrados en el mes.</td></tr>') +
    pend.map(function(y){
      return '<tr><td><b>' + esc(y.c.locatario.nombre) + '</b><div class="small muted">' + esc(nombreInm(y.c.inmuebleId)) + '</div></td><td></td><td class="n">' + fmt(y.f.debe - y.f.pagado) + '</td><td colspan="2">' + tagEstado(y.f.estado) + '</td><td><button class="btn sm p" onclick="modalPago(null,\'' + y.c.id + '\',\'' + p + '\')">Cobrar</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
}
function setRecibio(id, quien){ var x = byId('pagos', id); x.recibio = [{ quien: quien, monto: totalPago(x) }]; guardar('pagos', x); renderLiquidacion(); toast('Recibido por ' + nombreReceptor(quien)); }
function setMedio(id, m){ var x = byId('pagos', id); x.medio = m; guardar('pagos', x); }

// ─── movimientos (retiros, transferencias, aportes, pagos entre socios, ajustes) ───
function modalMovimiento(id, socioId, tipo, monto){
  var m = id ? JSON.parse(JSON.stringify(byId('movimientos', id))) : { fecha: LIQ.per === perHoy() ? hoy() : finDeMes(LIQ.per), socioId: socioId || DB.config.socios[0].id, tipo: tipo || 'retiro', monto: monto || '', concepto: '' };
  var socios = DB.config.socios.map(function(s){ return [s.id, s.nombre]; });
  abrirModal(id ? 'Editar movimiento' : 'Retiro / transferencia / ajuste',
    '<div class="fr">' + sel('mv-tipo', 'Tipo', TIPOS_MOV, m.tipo, 'onchange="movTipo()"') + '</div>' +
    '<div class="fr">' + sel('mv-socio', 'Socio', socios, m.socioId) + '<div id="mv-dest-w">' + sel('mv-dest', 'Le pagó a', socios, m.destinoId || (DB.config.socios[1] || DB.config.socios[0]).id) + '</div></div>' +
    '<div class="fr">' + inp('mv-fecha', 'Fecha', m.fecha, 'date') + inp('mv-monto', 'Monto', m.monto, 'number', 'step="0.01"') + sel('mv-medio', 'Medio', ['Efectivo', 'Transferencia', 'Otro'], m.medio || 'Efectivo') + '</div>' +
    inp('mv-conc', 'Concepto / detalle', m.concepto, 'text', 'placeholder="Ej: retiro efectivo 11/10, transferencia Anto, compra bolsas…"') +
    '<div class="hint" style="margin-top:8px" id="mv-ayuda"></div>' + lineaAuditoria(id ? m : null),
    (id ? '<button class="btn d" onclick="borrar(\'movimientos\',\'' + id + '\');cerrarModal();renderTodo()">Eliminar</button><span style="flex:1"></span>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarMovimiento(\'' + (id || '') + '\')">Guardar</button>');
  movTipo();
}
function movTipo(){
  var t = val('mv-tipo');
  $('mv-dest-w').style.display = t === 'entre' ? '' : 'none';
  $('mv-ayuda').textContent = {
    retiro: 'La administración le entrega efectivo al socio: baja su neto a cobrar y la caja.',
    transferencia: 'La administración le transfiere al socio lo que le corresponde: baja su neto a cobrar y la caja.',
    aporte: 'El socio pone dinero en la caja (por ejemplo para pagar un arreglo): sube su neto a cobrar.',
    entre: 'Un socio le paga directamente al otro (por ejemplo para compensar un cobro de condominio).',
    ajuste: 'Corrección manual. Positivo = a favor del socio; negativo = en contra.'
  }[t];
}
function guardarMovimiento(id){
  var m = id ? byId('movimientos', id) : {};
  m.tipo = val('mv-tipo'); m.socioId = val('mv-socio'); m.destinoId = m.tipo === 'entre' ? val('mv-dest') : '';
  m.fecha = val('mv-fecha'); m.monto = num(val('mv-monto')); m.medio = val('mv-medio'); m.concepto = val('mv-conc');
  if (!m.fecha || !m.monto) { toast('Completá fecha y monto'); return; }
  if (m.tipo === 'entre' && m.destinoId === m.socioId) { toast('Elegí dos socios distintos'); return; }
  if (m.tipo !== 'ajuste') m.monto = Math.abs(m.monto);
  guardar('movimientos', m); cerrarModal(); renderTodo(); toast('Movimiento guardado');
}

// ─── salidas: texto para WhatsApp, PDF y Excel ───
function liquidacionTexto(){
  var p = LIQ.per, t = '*LIQUIDACIÓN ALQUILERES ' + perNom(p).toUpperCase() + '*\n';
  DB.config.socios.filter(function(s){ return VISTA === 'total' || VISTA === s.id; }).forEach(function(s){
    var R = rendicion(p, s.id, true);
    t += '\n*' + s.nombre.toUpperCase() + '*\n' + R.alq.map(function(a){ return '• ' + titulo(a.loc) + ': ' + fmt(a.monto); }).join('\n');
    t += '\nTotal alquileres: ' + fmt(R.totalAlq) + '\nComisión ' + (DB.config.administrador || '') + ' ' + pct(DB.config.comisionPct, 2) + ': −' + fmt(R.com);
    R.gastos.forEach(function(g){ t += '\n' + g.txt + ': −' + fmt(g.monto); });
    R.movs.forEach(function(m){ t += '\n' + m.txt + ': ' + (m.monto < 0 ? '−' + fmt(-m.monto) : fmt(m.monto)); });
    if (R.saldoAnt) t += '\nSaldo anterior: ' + fmt(R.saldoAnt);
    t += '\n*NETO A COBRAR: ' + fmt(R.neto) + '*\n';
  });
  abrirModal('Texto para enviar', '<textarea class="f" id="liq-txt" style="min-height:320px">' + esc(t) + '</textarea>',
    '<button class="btn" onclick="copiar($(\'liq-txt\').value)">Copiar</button><a class="btn p" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t) + '">Abrir WhatsApp</a>');
}
function liquidacionPDF(){
  var JS = window.jspdf && window.jspdf.jsPDF; if (!JS) { toast('Cargando PDF…'); return; }
  var p = LIQ.per, doc = new JS({ unit: 'mm', format: 'a4' });
  var socios = DB.config.socios.filter(function(s){ return VISTA === 'total' || VISTA === s.id; });
  doc.setFillColor(15, 118, 110); doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('LIQUIDACIÓN ALQUILERES — ' + perNom(p).toUpperCase(), 14, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text('Administración: ' + (DB.config.administrador || '') + ' · emitida el ' + fDate(hoy()), 14, 18.5);
  doc.setTextColor(15, 23, 42);
  var colW = socios.length > 1 ? 88 : 182;
  socios.forEach(function(s, k){
    var R = rendicion(p, s.id, true), x0 = 14 + k * (colW + 6), y = 32, xr = x0 + colW;
    function ln(t, v, bold){ if (y > 285) return; doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(String(t).slice(0, colW > 100 ? 90 : 44), x0 + 1, y); if (v != null) doc.text(v < 0 ? '- ' + fmt(-v) : fmt(v), xr - 1, y, { align: 'right' }); y += 4.6; }
    function sec(t){ y += 1.5; doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(t, x0 + 1, y); doc.setTextColor(15, 23, 42); doc.setFontSize(8.5); y += 4.2; }
    doc.setFillColor(230, 240, 238); doc.rect(x0, y - 5, colW, 7.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(s.nombre.toUpperCase(), x0 + 2, y); y += 8;
    doc.setFontSize(8.5);
    sec('ALQUILERES');
    R.alq.forEach(function(a){ ln(titulo(a.loc) + (a.pct < 100 ? ' (' + r2(a.pct) + '%)' : ''), a.monto); });
    doc.setDrawColor(203, 213, 225); doc.line(x0, y - 3, xr, y - 3); ln('TOTAL NETO ALQUILERES', R.totalAlq, true);
    ln('Comisión ' + (DB.config.administrador || '') + ' ' + pct(DB.config.comisionPct, 2), -R.com);
    if (R.gastos.length) { sec('GASTOS'); R.gastos.forEach(function(g){ ln(g.txt, -g.monto); }); }
    if (R.movs.length) { sec('RETIROS / TRANSFERENCIAS'); R.movs.forEach(function(m){ ln(m.txt, m.monto); }); }
    if (R.saldoAnt) ln('Saldo de meses anteriores', R.saldoAnt);
    y += 2; doc.setFillColor(R.neto < -1 ? 254 : 204, R.neto < -1 ? 226 : 251, R.neto < -1 ? 226 : 241); doc.rect(x0, y - 5, colW, 8, 'F');
    doc.setFontSize(10.5); ln('NETO A COBRAR', R.neto, true); doc.setFontSize(8.5);
  });
  doc.save('Liquidacion ' + perNom(p) + '.pdf');
}
function liquidacionExcel(){
  if (!window.XLSX) { toast('Cargando Excel…'); return; }
  var p = LIQ.per, wb = XLSX.utils.book_new();
  DB.config.socios.filter(function(s){ return VISTA === 'total' || VISTA === s.id; }).forEach(function(s){
    var R = rendicion(p, s.id, true), filas = [];
    R.alq.forEach(function(a){ filas.push({ Seccion: 'Alquileres', Concepto: a.loc + ' — ' + a.inm, '%': a.pct, Monto: r2(a.monto) }); });
    filas.push({ Seccion: 'Total', Concepto: 'TOTAL NETO ALQUILERES', Monto: r2(R.totalAlq) });
    filas.push({ Seccion: 'Comisión', Concepto: 'Comisión ' + (DB.config.administrador || ''), Monto: -r2(R.com) });
    R.gastos.forEach(function(g){ filas.push({ Seccion: 'Gastos', Concepto: g.txt, Monto: -r2(g.monto) }); });
    R.movs.forEach(function(m){ filas.push({ Seccion: 'Retiros/transferencias', Concepto: m.txt, Monto: r2(m.monto) }); });
    if (R.saldoAnt) filas.push({ Seccion: 'Saldo anterior', Concepto: 'Meses anteriores', Monto: r2(R.saldoAnt) });
    filas.push({ Seccion: 'Neto', Concepto: 'NETO A COBRAR', Monto: r2(R.neto) });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), s.nombre.slice(0, 30));
  });
  XLSX.writeFile(wb, 'Liquidacion ' + perNom(p) + '.xlsx');
}
