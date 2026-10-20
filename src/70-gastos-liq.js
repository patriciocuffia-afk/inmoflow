// ═══════════════════════════════════════════
// GASTOS por inmueble
// ═══════════════════════════════════════════
var FILTRO_GAS = { desde: perAdd(perHoy(), -11), hasta: perHoy(), inm: '', cat: '' };
// Quién pagó un gasto: la caja de la administración, uno de los socios (se le reintegra en la liquidación),
// un propietario por fuera (no entra en la liquidación) o el locatario (solo informativo).
function pagadoPorOpciones(){
  return [['admin', 'Administración (sale de la caja)']].concat(DB.config.socios.map(function(s){ return ['socio:' + s.id, 'Lo pagó ' + s.nombre + ' (se le reintegra)']; }))
    .concat([['propietario', 'Propietario, por fuera de la liquidación'], ['locatario', 'Locatario (a su cargo, informativo)']]);
}
function tagPagadoPor(g){
  if (g.pagadoPor === 'admin') return '<span class="tag t-warn">Caja adm.</span>';
  if (String(g.pagadoPor).indexOf('socio:') === 0) return '<span class="tag t-info">' + esc(nombreSocio(g.pagadoPor.slice(6))) + '</span>';
  return { propietario: '<span class="tag t-mut">Propietario</span>', locatario: '<span class="tag t-mut">Locatario</span>' }[g.pagadoPor] || '';
}

function renderGastos(){
  var lista = vivos('gastos').filter(function(g){
    var p = per(g.fecha);
    if (p < FILTRO_GAS.desde || p > FILTRO_GAS.hasta) return false;
    if (FILTRO_GAS.inm && g.inmuebleId !== FILTRO_GAS.inm) return false;
    if (FILTRO_GAS.cat && g.categoria !== FILTRO_GAS.cat) return false;
    if (VISTA !== 'total' && !factor(g.distribucion || distribucionInm(byId('inmuebles', g.inmuebleId)))) return false;
    return true;
  });
  var inms = vivos('inmuebles').sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  var porCat = {};
  lista.forEach(function(g){ if (g.pagadoPor === 'locatario') return; var f = factor(g.distribucion || distribucionInm(byId('inmuebles', g.inmuebleId))); porCat[g.categoria] = (porCat[g.categoria] || 0) + num(g.montoARS) * f; });
  var cats = Object.keys(porCat).sort(function(a, b){ return porCat[b] - porCat[a]; });
  $('p-gastos').innerHTML = '<h2>Gastos</h2><p class="sub">Arreglos, pintura, electricidad, impuestos… por inmueble. Los que paga la administración se descuentan solos en la liquidación.</p>' +
    '<div class="bar"><select class="f" style="width:auto" onchange="FILTRO_GAS.inm=this.value;renderGastos()"><option value="">Todos los inmuebles</option>' + inms.map(function(i){ return '<option value="' + i.id + '"' + (FILTRO_GAS.inm === i.id ? ' selected' : '') + '>' + esc(i.nombre) + '</option>'; }).join('') + '</select>' +
    '<select class="f" style="width:auto" onchange="FILTRO_GAS.cat=this.value;renderGastos()"><option value="">Todas las categorías</option>' + DB.config.categoriasGasto.map(function(c){ return '<option' + (FILTRO_GAS.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
    '<input class="f" style="width:auto" type="month" value="' + FILTRO_GAS.desde + '" onchange="FILTRO_GAS.desde=this.value;renderGastos()"><span class="muted">a</span><input class="f" style="width:auto" type="month" value="' + FILTRO_GAS.hasta + '" onchange="FILTRO_GAS.hasta=this.value;renderGastos()">' +
    '<span class="grow"></span><button class="btn" onclick="exportarExcel(\'gastos\')">Excel</button><button class="btn p" onclick="modalGasto()">+ Gasto</button></div>' +
    (cats.length ? '<div class="card" style="margin-bottom:12px"><div class="card-h"><h3>Gastos por categoría</h3><span class="muted small">Total ' + fmt(sum(cats, function(c){ return porCat[c]; })) + '</span></div><div class="viz" id="gs-chart"></div></div>' : '') +
    tablaGastos(lista);
  var totCat = sum(cats, function(c){ return porCat[c]; });
  if (cats.length) vizBarrasH($('gs-chart'), cats.map(function(c){
    var n = lista.filter(function(g){ return g.categoria === c && g.pagadoPor !== 'locatario'; }).length;
    return { label: c, valor: porCat[c], texto: compacto(porCat[c], '$ '), click: function(){ FILTRO_GAS.cat = FILTRO_GAS.cat === c ? '' : c; renderGastos(); },
      tip: { titulo: c, filas: [{ v: fmt(porCat[c]), l: 'en el período', c: 'var(--s1)' }, { v: pct(porCat[c] / totCat * 100), l: 'del total' }, { v: String(n), l: n === 1 ? 'gasto' : 'gastos' }] } };
  }), 'var(--s1)');
}
function tablaGastos(lista){
  if (!lista.length) return '<div class="card empty">Sin gastos registrados.</div>';
  lista = lista.slice().sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; });
  var T = { ars: 0, of: 0, bl: 0 };
  var rows = lista.map(function(g){
    var f = factor(g.distribucion || distribucionInm(byId('inmuebles', g.inmuebleId))), cuenta = g.pagadoPor !== 'locatario';
    var a = num(g.montoARS) * f, of = usdGasto(g, 'oficial') * f, bl = usdGasto(g, 'blue') * f;
    if (cuenta) { T.ars += a; T.of += of; T.bl += bl; }
    return '<tr class="click" onclick="modalGasto(\'' + g.id + '\')"><td>' + fDate(g.fecha) + '</td><td>' + esc(nombreInm(g.inmuebleId)) + '</td><td>' + esc(g.categoria) + (g.capital ? ' <span class="tag t-info">mejora</span>' : '') + '</td><td>' + esc(g.descripcion || '') + (g.proveedor ? '<div class="small muted">' + esc(g.proveedor) + '</div>' : '') + '</td>' +
      '<td>' + tagPagadoPor(g) + '</td>' +
      '<td class="n b">' + fmt(a) + (g.moneda === 'USD' ? '<div class="small muted">' + fmtU(g.monto) + '</div>' : '') + '</td><td class="n usd-o">' + fmtU(of) + '</td><td class="n usd-b">' + fmtU(bl) + '</td><td>' + ((g.docs || []).length ? '📎' : '') + '</td></tr>';
  }).join('');
  return '<div class="tw"><table><thead><tr><th>Fecha</th><th>Inmueble</th><th>Categoría</th><th>Detalle</th><th>Pagó</th><th class="n">Pesos</th><th class="n">US$ oficial</th><th class="n">US$ blue</th><th></th></tr></thead><tbody>' + rows +
    '</tbody><tfoot><tr><td colspan="5">Total (sin los del locatario)</td><td class="n">' + fmt(T.ars) + '</td><td class="n usd-o">' + fmtU(T.of) + '</td><td class="n usd-b">' + fmtU(T.bl) + '</td><td></td></tr></tfoot></table></div>';
}
function modalGasto(id, inmId){
  var g = id ? JSON.parse(JSON.stringify(byId('gastos', id))) : { inmuebleId: inmId || FILTRO_GAS.inm || '', fecha: hoy(), categoria: 'Arreglos', moneda: 'ARS', pagadoPor: 'admin', reparto: 'titularidad' };
  var inms = vivos('inmuebles').sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  if (!inms.length) { toast('Primero cargá un inmueble'); return; }
  abrirModal(id ? 'Editar gasto' : 'Nuevo gasto',
    '<div class="fr">' + sel('e-inm', 'Inmueble *', inms.map(function(i){ return [i.id, i.nombre]; }), g.inmuebleId) + inp('e-fecha', 'Fecha', g.fecha, 'date', 'onchange="gastoTC()"') + '</div>' +
    '<div class="fr">' + sel('e-cat', 'Categoría', DB.config.categoriasGasto, g.categoria, 'onchange="if(this.value===\'Mejora / inversión\')$(\'e-cap\').checked=true"') + inp('e-prov', 'Proveedor / quién lo hizo', g.proveedor) + '</div>' +
    inp('e-desc', 'Descripción', g.descripcion, 'text', 'placeholder="Ej: cambio de termotanque"') +
    '<div class="fr" style="margin-top:10px">' + sel('e-mon', 'Moneda', [['ARS', 'Pesos'], ['USD', 'Dólares']], g.moneda, 'onchange="gastoTC(1)"') + inp('e-monto', 'Monto *', g.monto, 'number', 'step="0.01" oninput="gastoTC(1)"') + inp('e-cof', 'Dólar oficial', g.cotOf || '', 'number', 'step="0.01" oninput="gastoTC(1)"') + inp('e-cbl', 'Dólar blue', g.cotBl || '', 'number', 'step="0.01" oninput="gastoTC(1)"') + '</div>' +
    '<div class="calc" id="e-calc"></div>' +
    '<div class="fr" style="margin-top:10px">' + sel('e-pag', '¿Quién lo pagó?', pagadoPorOpciones(), g.pagadoPor) + sel('e-rep', 'Se reparte', [['titularidad', 'Según titularidad del inmueble']].concat(DB.config.socios.map(function(s){ return ['solo:' + s.id, 'Solo ' + s.nombre]; })), g.reparto || 'titularidad') + '</div>' +
    '<label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="e-cap"' + (g.capital ? ' checked' : '') + '> Es mejora / inversión (suma al costo del inmueble, no resta de la renta)</label>' +
    '<div style="margin-top:10px">' + txa('e-notas', 'Notas', g.notas) + '</div>' +
    (id ? '<div class="fsec">Comprobantes</div>' + htmlDocs('gastos', g, true) : '<div class="hint" style="margin-top:8px">Guardá el gasto y después podés adjuntar la factura o foto del comprobante.</div>') + lineaAuditoria(id ? g : null),
    (id ? '<button class="btn d" onclick="eliminarGasto(\'' + id + '\')">Eliminar</button><span style="flex:1"></span>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarGasto(\'' + (id || '') + '\')">Guardar</button>');
  gastoTC(g.cotOf ? 1 : 0);
  if (id) cargarMiniaturas(g.docs || []);
}
function gastoTC(manual){
  if (!manual) { var f = val('e-fecha'); $('e-cof').value = cotiz('oficial', f) || ''; $('e-cbl').value = cotiz('blue', f) || ''; }
  var m = num(val('e-monto')), of = num(val('e-cof')), bl = num(val('e-cbl')), usd = val('e-mon') === 'USD';
  var ars = usd ? m * bl : m;
  $('e-calc').innerHTML = '<div class="row"><span>En pesos</span><span>' + fmt(ars) + '</span></div><div class="row"><span>En dólar oficial</span><span class="usd-o">' + fmtU2(usd ? m : of ? ars / of : 0) + '</span></div><div class="row"><span>En dólar blue</span><span class="usd-b">' + fmtU2(usd ? m : bl ? ars / bl : 0) + '</span></div>';
}
function guardarGasto(id){
  var g = id ? byId('gastos', id) : { docs: [] };
  g.inmuebleId = val('e-inm'); g.fecha = val('e-fecha'); g.categoria = val('e-cat'); g.proveedor = val('e-prov'); g.descripcion = val('e-desc');
  g.moneda = val('e-mon'); g.monto = num(val('e-monto')); g.cotOf = num(val('e-cof')); g.cotBl = num(val('e-cbl'));
  if (!g.monto) { toast('Ingresá el monto'); return; }
  g.montoARS = g.moneda === 'USD' ? r2(g.monto * (g.cotBl || cotiz('blue', g.fecha))) : g.monto;
  g.pagadoPor = val('e-pag'); g.reparto = val('e-rep'); g.capital = val('e-cap'); g.notas = val('e-notas');
  var inm = byId('inmuebles', g.inmuebleId);
  g.distribucion = g.reparto.indexOf('solo:') === 0 ? [{ socioId: g.reparto.slice(5), pct: 100 }] : distribucionInm(inm).map(function(t){ return { socioId: t.socioId, pct: t.pct }; });
  guardar('gastos', g); cerrarModal(); renderTodo(); toast('Gasto guardado');
}
function eliminarGasto(id){ confirmar('¿Eliminar este gasto?').then(function(ok){ if (ok) { borrar('gastos', id); cerrarModal(); renderTodo(); } }); }

// ═══════════════════════════════════════════
// RENTABILIDAD Y AMORTIZACIÓN
// ═══════════════════════════════════════════
var RENT_DOLAR = localStorage.getItem('inmoflow_rentdolar') || 'blue';
function renderRentabilidad(){
  var b = RENT_DOLAR === 'blue', k = b ? 'Bl' : 'Of', cls = b ? 'usd-b' : 'usd-o';
  var lista = vivos('inmuebles').filter(function(i){ return factorInm(i) > 0; }).map(function(i){ return { i: i, r: rentabilidad(i) }; })
    .sort(function(a, b2){ return b2.r['rent' + k] - a.r['rent' + k]; });
  var T = { costo: 0, neto: 0, anual: 0 };
  lista.forEach(function(x){ T.costo += x.r['costo' + k]; T.neto += x.r['neto' + k]; T.anual += x.r['anual' + k]; });
  var conCosto = lista.filter(function(x){ return x.r['costo' + k] > 0; });
  var Tc = { costo: sum(conCosto, function(x){ return x.r['costo' + k]; }), anual: sum(conCosto, function(x){ return x.r['anual' + k]; }), neto: sum(conCosto, function(x){ return x.r['neto' + k]; }) };
  $('p-rentabilidad').innerHTML = '<h2>Rentabilidad y amortización</h2><p class="sub">Cada cobro y cada gasto se convierte a dólares con la cotización de su fecha. Neto = cobrado − comisión − gastos (las mejoras suman al costo).' + (VISTA !== 'total' ? ' Mostrando la parte de <b>' + esc(nombreSocio(VISTA)) + '</b>.' : '') + '</p>' +
    '<div class="bar"><div class="subtabs" style="margin:0"><button class="' + (b ? 'on' : '') + '" onclick="RENT_DOLAR=\'blue\';localStorage.setItem(\'inmoflow_rentdolar\',\'blue\');renderRentabilidad()">Dólar blue</button><button class="' + (!b ? 'on' : '') + '" onclick="RENT_DOLAR=\'oficial\';localStorage.setItem(\'inmoflow_rentdolar\',\'oficial\');renderRentabilidad()">Dólar oficial</button></div></div>' +
    '<div class="kpis">' + kpi('Capital invertido', '<span class="' + cls + '">' + fmtU(Tc.costo) + '</span>', conCosto.length + ' de ' + lista.length + ' inmuebles con costo cargado') +
      kpi('Neto anual', '<span class="' + cls + '">' + fmtU(T.anual) + '</span>', fmtU(T.anual / 12) + ' por mes') +
      kpi('Rentabilidad cartera', Tc.costo ? pct(Tc.anual / Tc.costo * 100, 2) : '—', 'anual en dólares') +
      kpi('Recuperado', Tc.costo ? pct(Tc.neto / Tc.costo * 100) : '—', fmtU(Tc.neto) + ' acumulado') +
      kpi('Falta para recuperar', Tc.anual > 0 ? anios(Math.max(0, (Tc.costo - Tc.neto) / Tc.anual)) : '—', 'al ritmo actual') + '</div>' +
    (function(){
      var modo = RENT_GRAF === 'rent' && conCosto.length ? 'rent' : 'neto';
      return '<div class="card" style="margin-bottom:12px"><div class="card-h"><h3>' + (modo === 'rent' ? 'Rentabilidad anual por inmueble' : 'Neto anual por inmueble') + ' <span class="muted small">(dólar ' + RENT_DOLAR + ')</span></h3><div class="seg-ctl">' +
        '<button class="' + (modo === 'rent' ? 'on' : '') + '" onclick="RENT_GRAF=\'rent\';renderRentabilidad()"' + (conCosto.length ? '' : ' disabled title="Cargá el costo de algún inmueble"') + '>Rentabilidad %</button><button class="' + (modo === 'neto' ? 'on' : '') + '" onclick="RENT_GRAF=\'neto\';renderRentabilidad()">Neto anual US$</button></div></div>' +
        '<div class="viz" id="rg-chart"></div><div class="hint" style="margin-top:6px">Pasá el mouse para ver el detalle; tocá una barra para abrir el inmueble.</div></div>';
    })() +
    (lista.length ? '<div class="tw"><table><thead><tr><th>Inmueble</th><th class="n">Costo</th><th class="n">Neto acumulado</th><th class="n">Neto anual</th><th class="n">Rentab.</th><th style="min-width:140px">Recuperado</th><th class="n">Amortiza en</th><th class="n">Faltan</th></tr></thead><tbody>' +
      lista.map(function(x){
        var r = x.r, c = r['costo' + k];
        return '<tr class="click" onclick="verInmueble(\'' + x.i.id + '\',\'' + (c ? 'resumen' : 'costo') + '\')"><td><b>' + esc(x.i.nombre) + '</b></td><td class="n ' + cls + '">' + (c ? fmtU(c) : '<span class="tag t-warn">cargar costo</span>') + '</td><td class="n">' + fmtU(r['neto' + k]) + '</td><td class="n">' + fmtU(r['anual' + k]) + '</td>' +
          '<td class="n b">' + (c ? pct(r['rent' + k], 2) : '—') + '</td><td>' + (c ? '<div class="meter"><i style="width:' + Math.min(100, Math.max(0, r['recup' + k])) + '%"></i></div><div class="small muted">' + pct(r['recup' + k]) + '</div>' : '') + '</td>' +
          '<td class="n">' + (c ? anios(r['payback' + k]) : '—') + '</td><td class="n b">' + (c ? anios(r['resta' + k]) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card empty">Sin inmuebles.</div>') +
    '<div class="hint" style="margin-top:10px">“Amortiza en” = años totales para recuperar la inversión con el neto anual actual. “Faltan” descuenta lo ya cobrado. Si un inmueble tiene menos de 12 meses de cobros, el neto se anualiza.</div>';
  var modo = RENT_GRAF === 'rent' && conCosto.length ? 'rent' : 'neto';
  var items = (modo === 'rent' ? conCosto : lista.filter(function(x){ return x.r['anual' + k] > 0; }))
    .map(function(x){
      var r = x.r, v = modo === 'rent' ? r['rent' + k] : r['anual' + k];
      return { label: x.i.nombre.replace(/^Inmueble de /, ''), valor: v, texto: modo === 'rent' ? pct(v, 2) : fmtU(v),
        tip: { titulo: x.i.nombre, filas: [
          { v: r['costo' + k] ? pct(r['rent' + k], 2) : 'sin costo', l: 'rentabilidad anual', c: modo === 'rent' ? 'var(--s1)' : null },
          { v: fmtU(r['anual' + k]), l: 'neto anual', c: modo === 'neto' ? 'var(--s1)' : null },
          { v: r['costo' + k] ? fmtU(r['costo' + k]) : '—', l: 'inversión' },
          { v: r['costo' + k] ? pct(r['recup' + k]) : '—', l: 'recuperado' },
          { v: r['costo' + k] ? anios(r['resta' + k]) : '—', l: 'falta para recuperar' }
        ] },
        click: function(){ verInmueble(x.i.id, 'resumen'); } };
    }).sort(function(a, b2){ return b2.valor - a.valor; });
  vizBarrasH($('rg-chart'), items, 'var(--s1)');
}
var RENT_GRAF = 'rent';
