// ═══════════════════════════════════════════
// INMUEBLES
// ═══════════════════════════════════════════
var TIPOS_INM = ['Departamento', 'Casa', 'Dúplex', 'Local comercial', 'Oficina', 'Cochera', 'Galpón', 'Terreno', 'Otro'];
var IDENTIF = [
  ['rentas', 'N° cuenta Rentas (Inmobiliario)', 'https://www.rentascordoba.gob.ar/'],
  ['municipal', 'Cuenta municipal', ''],
  ['catastro', 'Nomenclatura catastral', ''],
  ['matricula', 'Matrícula / Folio', ''],
  ['epec', 'Suministro EPEC', 'https://www.epec.com.ar/'],
  ['agua', 'Cuenta agua', ''],
  ['gas', 'Cuenta gas', 'https://www.ecogas.com.ar/'],
  ['expensas', 'Administración / consorcio', '']
];
var FILTRO_INM = '';

function renderInmuebles(){
  var lista = vivos('inmuebles').filter(function(i){
    if (VISTA !== 'total' && !factorInm(i)) return false;
    var q = FILTRO_INM.toLowerCase(); if (!q) return true;
    var c = contratoVigenteDe(i.id);
    return (i.nombre + ' ' + (i.direccion || '') + ' ' + (c && c.locatario ? c.locatario.nombre : '')).toLowerCase().indexOf(q) >= 0;
  }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  var porDueno = INM_MODO === 'dueno';
  $('p-inmuebles').innerHTML =
    '<h2>Inmuebles</h2><p class="sub">' + lista.length + ' inmuebles' + (VISTA !== 'total' ? ' con participación de ' + esc(nombreSocio(VISTA)) : '') + '</p>' +
    '<div class="bar"><div class="seg-ctl"><button class="' + (porDueno ? 'on' : '') + '" onclick="setInmModo(\'dueno\')">Por dueño</button><button class="' + (!porDueno ? 'on' : '') + '" onclick="setInmModo(\'inmueble\')">Por inmueble</button></div>' +
    '<input class="f grow" placeholder="Buscar por nombre, dirección o locatario…" value="' + esc(FILTRO_INM) + '" oninput="FILTRO_INM=this.value;renderInmuebles();this.focus();this.setSelectionRange(this.value.length,this.value.length)"><button class="btn p" onclick="modalInmueble()">+ Inmueble</button></div>' +
    (!lista.length ? '<div class="card empty">No hay inmuebles cargados.</div>' : porDueno ? htmlPorDueno(lista) : '<div class="grid g3">' + lista.map(cardInmueble).join('') + '</div>');
}
var INM_MODO = localStorage.getItem('inmoflow_inmmodo') || 'dueno';
var DUENOS_ABIERTOS = {};
function setInmModo(m){ INM_MODO = m; localStorage.setItem('inmoflow_inmmodo', m); renderInmuebles(); }

// Agrupa por combinación de titulares: "Cuffia Patricio", "Cuffia Benjamín", "Cuffia Patricio y Cuffia Benjamín (50/50)"…
function grupoDueno(i){
  var t = distribucionInm(i).slice().sort(function(a, b){ return DB.config.socios.findIndex(function(s){ return s.id === a.socioId; }) - DB.config.socios.findIndex(function(s){ return s.id === b.socioId; }); });
  return {
    key: t.map(function(x){ return x.socioId + ':' + x.pct; }).join('|'),
    nombre: t.map(function(x){ return nombreSocio(x.socioId); }).join(' y '),
    detalle: t.length > 1 ? 'Condominio ' + t.map(function(x){ return r2(x.pct) + '%'; }).join(' / ') : 'Titular único',
    socios: t.map(function(x){ return x.socioId; }), compartido: t.length > 1
  };
}
function iniciales(n){ return String(n || '').split(/\s+/).filter(Boolean).map(function(w){ return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
function htmlPorDueno(lista){
  var grupos = {}, orden = [], ph = perHoy();
  lista.forEach(function(i){ var g = grupoDueno(i); if (!grupos[g.key]) { grupos[g.key] = { g: g, inms: [] }; orden.push(g.key); } grupos[g.key].inms.push(i); });
  orden.sort(function(a, b){ var A = grupos[a].g, B = grupos[b].g; return (A.compartido - B.compartido) || A.nombre.localeCompare(B.nombre); });
  if (FILTRO_INM) orden.forEach(function(k){ DUENOS_ABIERTOS[k] = true; });
  return '<div class="duenos">' + orden.map(function(k){
    var G = grupos[k], abierto = !!DUENOS_ABIERTOS[k];
    var alq = 0, cobr = 0, deuda = 0, libres = 0, nPag = 0, nCtr = 0;
    G.inms.forEach(function(i){
      var c = contratoVigenteDe(i.id); if (!c) { libres++; return; }
      var f = cuentaCorriente(c).filas.filter(function(x){ return x.periodo === ph; })[0];
      alq += montoVigente(c, ph);
      if (f) { nCtr++; cobr += f.pagado; if (f.estado === 'pagado') nPag++; }
      deuda += sum(deudaContrato(c), function(x){ return x.debe - x.pagado; });
    });
    var av = G.g.socios.map(function(s){ return '<span class="av">' + esc(iniciales(nombreSocio(s))) + '</span>'; }).join('');
    return '<div class="dueno' + (abierto ? ' open' : '') + '">' +
      '<button class="dueno-h" onclick="DUENOS_ABIERTOS[\'' + k + '\']=!DUENOS_ABIERTOS[\'' + k + '\'];renderInmuebles()" aria-expanded="' + abierto + '">' +
        '<span class="avs">' + av + '</span>' +
        '<span class="dueno-n"><b>' + esc(G.g.nombre) + '</b><span class="small muted">' + esc(G.g.detalle) + ' · ' + G.inms.length + (G.inms.length === 1 ? ' inmueble' : ' inmuebles') + (libres ? ' · ' + libres + ' libre' + (libres > 1 ? 's' : '') : '') + '</span></span>' +
        '<span class="dueno-k"><span class="small muted">Alquileres ' + perNom(ph).split(' ')[0].toLowerCase() + '</span><b>' + fmt(alq) + '</b></span>' +
        (nCtr ? '<span class="dueno-k"><span class="small muted">Cobrado</span><b>' + nPag + ' / ' + nCtr + '</b></span>' : '<span class="dueno-k"><span class="small muted">Cuenta</span><b>desde ' + esc(perNom(G.inms.map(function(i){ var c = contratoVigenteDe(i.id); return c && c.ccDesde || ''; }).sort().pop() || ph).toLowerCase()) + '</b></span>') +
        (deuda > 0 ? '<span class="tag t-bad">Deuda ' + fmt(deuda) + '</span>' : '<span class="tag t-ok">Al día</span>') +
        '<span class="chev">' + (abierto ? '▴' : '▾') + '</span>' +
      '</button>' +
      (abierto ? '<div class="dueno-b">' + G.inms.sort(function(a, b){ return a.nombre.localeCompare(b.nombre); }).map(tileInmueble).join('') +
        '<button class="tile tile-add" onclick="modalInmueble(null,\'' + k + '\')"><span>+</span>Agregar inmueble a ' + esc(G.g.nombre) + '</button></div>' : '') +
    '</div>';
  }).join('') + '</div>';
}
function tileInmueble(i){
  var c = contratoVigenteDe(i.id), ph = perHoy();
  var f = c ? cuentaCorriente(c).filas.filter(function(x){ return x.periodo === ph; })[0] : null;
  return '<button class="tile" onclick="verInmueble(\'' + i.id + '\')">' +
    '<span class="tile-t"><b>' + esc(i.nombre) + '</b>' + (c && f ? tagEstado(f.estado) : tagEstado(c ? 'alquilado' : 'libre')) + '</span>' +
    '<span class="small muted">' + esc(i.direccion || i.tipo || '') + '</span>' +
    (c ? '<span class="tile-r"><span>' + esc(c.locatario.nombre) + '</span><b>' + fmt(montoVigente(c, ph)) + '</b></span>' : '<span class="tile-r muted">Sin contrato vigente</span>') +
  '</button>';
}
function cardInmueble(i){
  var c = contratoVigenteDe(i.id), r = rentabilidad(i), ph = perHoy();
  var dist = distribucionInm(i).map(function(t){ return esc(nombreSocio(t.socioId)) + ' ' + t.pct + '%'; }).join(' · ');
  var est = c ? cuentaCorriente(c).filas.filter(function(f){ return f.periodo === ph; })[0] : null;
  return '<div class="card pcard" onclick="verInmueble(\'' + i.id + '\')">' +
    '<div class="top"><div><div class="nm">' + esc(i.nombre) + '</div><div class="small muted">' + esc(i.direccion || i.tipo || '') + '</div></div>' + tagEstado(c ? 'alquilado' : 'libre') + '</div>' +
    '<div style="margin-top:8px">' +
      (c ? '<div class="row"><span class="muted">Locatario</span><span>' + esc(c.locatario.nombre) + '</span></div>' +
           '<div class="row"><span class="muted">Alquiler</span><span>' + fmt(montoVigente(c, ph)) + '</span></div>' +
           '<div class="row"><span class="muted">Este mes</span><span>' + (est ? tagEstado(est.estado) : '') + '</span></div>' : '') +
      '<div class="row"><span class="muted">Titulares</span><span class="small">' + dist + '</span></div>' +
      (r.costoBl ? '<div class="row"><span class="muted">Rentab. anual (blue)</span><span>' + pct(r.rentBl) + '</span></div>' +
        '<div class="meter" title="Recuperado ' + pct(r.recupBl) + '"><i style="width:' + Math.min(100, Math.max(0, r.recupBl)) + '%"></i></div><div class="hint">Recuperado ' + pct(r.recupBl) + ' · faltan ' + anios(r.restaBl) + '</div>' : '<div class="hint">Cargá el costo para ver rentabilidad</div>') +
    '</div></div>';
}

function modalInmueble(id, grupoKey){
  var tit0 = grupoKey ? grupoKey.split('|').map(function(x){ var a = x.split(':'); return { socioId: a[0], pct: num(a[1]) }; }) : [{ socioId: DB.config.socios[0].id, pct: 100 }];
  var i = id ? JSON.parse(JSON.stringify(byId('inmuebles', id))) : { nombre: '', tipo: 'Departamento', titulares: tit0, ids: {} };
  var tit = DB.config.socios.map(function(s){
    var t = (i.titulares || []).find(function(x){ return x.socioId === s.id; });
    return inp('ti-' + s.id, '% de ' + esc(s.nombre), t ? t.pct : 0, 'number', 'min="0" max="100" step="0.01"');
  }).join('');
  var ids = IDENTIF.map(function(d){ return inp('id-' + d[0], d[1], (i.ids || {})[d[0]] || ''); }).join('');
  abrirModal(id ? 'Editar inmueble' : 'Nuevo inmueble',
    '<div class="fsec">Datos</div>' +
    '<div class="fr">' + inp('i-nombre', 'Nombre / referencia *', i.nombre, 'text', 'placeholder="Ej: Dpto 2B Rosario de Peñaloza"') + sel('i-tipo', 'Tipo', TIPOS_INM, i.tipo) + '</div>' +
    '<div class="fr">' + inp('i-dir', 'Dirección', i.direccion) + inp('i-loc', 'Localidad', i.localidad || 'Río Segundo') + inp('i-sup', 'Superficie m²', i.superficie, 'number') + '</div>' +
    '<div class="fsec">Titularidad (copropiedad)</div><div class="fr">' + tit + '</div><div class="hint">La suma debe dar 100%. Cada cobro y gasto se reparte según estos porcentajes.</div>' +
    '<div class="fsec">Rentas, municipalidad y servicios</div><div class="fr">' + ids + '</div>' +
    inp('i-urlmuni', 'Link de la municipalidad para consultar tasas (opcional)', i.urlMunicipal, 'url', 'placeholder="https://…"') +
    '<div style="margin-top:10px">' + txa('i-notas', 'Notas', i.notas) + '</div>' + lineaAuditoria(id ? i : null),
    (id ? '<button class="btn d" onclick="eliminarInmueble(\'' + id + '\')">Eliminar</button><span style="flex:1"></span>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarInmueble(\'' + (id || '') + '\')">Guardar</button>');
}
function guardarInmueble(id){
  var i = id ? byId('inmuebles', id) : {};
  i.nombre = val('i-nombre'); if (!i.nombre) { toast('Poné un nombre al inmueble'); return; }
  i.tipo = val('i-tipo'); i.direccion = val('i-dir'); i.localidad = val('i-loc'); i.superficie = val('i-sup');
  i.titulares = DB.config.socios.map(function(s){ return { socioId: s.id, pct: num(val('ti-' + s.id)) }; }).filter(function(t){ return t.pct > 0; });
  var tot = sum(i.titulares, function(t){ return t.pct; });
  if (Math.abs(tot - 100) > 0.01) { toast('La titularidad suma ' + tot + '% — tiene que dar 100%'); return; }
  i.ids = {}; IDENTIF.forEach(function(d){ var v = val('id-' + d[0]); if (v) i.ids[d[0]] = v; });
  i.urlMunicipal = val('i-urlmuni'); i.notas = val('i-notas');
  i.costos = i.costos || []; i.docs = i.docs || [];
  guardar('inmuebles', i);
  cerrarModal(); toast('Inmueble guardado');
  if (!id) verInmueble(i.id); else renderTodo();
}
function eliminarInmueble(id){
  var n = vivos('contratos').filter(function(c){ return c.inmuebleId === id; }).length;
  confirmar('¿Eliminar este inmueble?' + (n ? ' Tiene ' + n + ' contrato(s) asociados que quedarán sin inmueble.' : '')).then(function(ok){
    if (!ok) return; borrar('inmuebles', id); cerrarModal(); ir('inmuebles');
  });
}

// ─── detalle de inmueble ─────────────────────
function renderDetalle(){
  if (!DETALLE) return ir('panel');
  if (DETALLE.tipo === 'inmueble') return renderDetInmueble();
  if (DETALLE.tipo === 'contrato') return renderDetContrato();
}
function subtabs(items, actual, fn){
  return '<div class="subtabs">' + items.map(function(t){ return '<button class="' + (t[0] === actual ? 'on' : '') + '" onclick="' + fn + '(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
}
function subInm(s){ DETALLE.sub = s; renderDetalle(); }

function renderDetInmueble(){
  var i = byId('inmuebles', DETALLE.id); if (!i) return ir('inmuebles');
  var c = contratoVigenteDe(i.id), s = DETALLE.sub, h = '';
  h += '<div class="back"><button class="btn sm ghost" onclick="ir(\'inmuebles\')">← Inmuebles</button></div>';
  h += '<div class="bar"><div class="grow"><h2>' + esc(i.nombre) + '</h2><div class="sub" style="margin:0">' + esc([i.tipo, i.direccion, i.localidad].filter(Boolean).join(' · ')) + '</div></div>' +
    '<button class="btn" onclick="modalInmueble(\'' + i.id + '\')">Editar</button>' +
    (c ? '<button class="btn p" onclick="modalPago(null,\'' + c.id + '\')">+ Cobro</button>' : '<button class="btn p" onclick="modalContrato(null,\'' + i.id + '\')">+ Contrato</button>') + '</div>';
  h += subtabs([['resumen', 'Resumen'], ['costo', 'Costo e inversión'], ['contratos', 'Contratos'], ['cobros', 'Cobros'], ['gastos', 'Gastos'], ['docs', 'Documentos y fotos']], s, 'subInm');
  if (s === 'resumen') h += detInmResumen(i, c);
  if (s === 'costo') h += detInmCosto(i);
  if (s === 'contratos') h += tablaContratos(vivos('contratos').filter(function(x){ return x.inmuebleId === i.id; }));
  if (s === 'cobros') h += tablaPagos(vivos('pagos').filter(function(p){ return p.inmuebleId === i.id; }));
  if (s === 'gastos') h += '<div class="bar"><button class="btn p" onclick="modalGasto(null,\'' + i.id + '\')">+ Gasto</button></div>' + tablaGastos(vivos('gastos').filter(function(g){ return g.inmuebleId === i.id; }));
  if (s === 'docs') h += htmlDocs('inmuebles', i);
  $('p-detalle').innerHTML = h;
  if (s === 'docs') cargarMiniaturas(i.docs || []);
  if (s === 'resumen') graficosInmueble(i);
}
function detInmResumen(i, c){
  var r = rentabilidad(i), ids = i.ids || {};
  var idsH = IDENTIF.filter(function(d){ return ids[d[0]]; }).map(function(d){
    var url = d[0] === 'municipal' ? i.urlMunicipal : d[2];
    return '<div>' + d[1] + '</div><div><span class="copy" onclick="copiar(\'' + esc(ids[d[0]]).replace(/'/g, '') + '\')" title="Copiar">' + esc(ids[d[0]]) + '</span>' + (url ? ' · <a href="' + esc(url) + '" target="_blank" rel="noopener">consultar ↗</a>' : '') + '</div>';
  }).join('');
  return '<div class="grid g2">' +
    '<div class="card"><h3>Contrato vigente</h3>' + (c ?
      '<div class="kv"><div>Locatario</div><div><a href="#" onclick="verContrato(\'' + c.id + '\');return false">' + esc(c.locatario.nombre) + '</a></div>' +
      '<div>Alquiler actual</div><div class="b">' + fmt(montoVigente(c, perHoy())) + '</div>' +
      '<div>Vigencia</div><div>' + fDate(c.inicio) + ' al ' + (c.fin ? fDate(c.fin) : '—') + '</div>' +
      '<div>Actualización</div><div>' + esc(INDICES[c.indice] || '') + (c.periodicidad ? ' cada ' + c.periodicidad + ' meses' : '') + '</div>' +
      '<div>Próximo ajuste</div><div>' + (proximoAjuste(c) ? perNom(proximoAjuste(c)) : '—') + '</div></div>'
      : '<div class="empty">Sin contrato vigente<br><button class="btn p" style="margin-top:8px" onclick="modalContrato(null,\'' + i.id + '\')">+ Nuevo contrato</button></div>') + '</div>' +
    '<div class="card"><h3>Rentabilidad' + (VISTA !== 'total' ? ' (parte de ' + esc(nombreSocio(VISTA)) + ')' : '') + '</h3>' + htmlRentab(r) + '</div>' +
    '<div class="card"><h3>Rentas, municipalidad y servicios</h3>' + (idsH ? '<div class="kv">' + idsH + '</div>' : '<div class="hint">Sin datos. Editá el inmueble para cargar los números de cuenta.</div>') + '</div>' +
    '<div class="card"><h3>Titularidad</h3>' + distribucionInm(i).map(function(t){ return '<div class="row"><span>' + esc(nombreSocio(t.socioId)) + '</span><span>' + t.pct + '%</span></div>'; }).join('') +
      (i.notas ? '<div class="hint" style="margin-top:8px;white-space:pre-wrap">' + esc(i.notas) + '</div>' : '') + '</div>' +
    '<div class="card" style="grid-column:1/-1"><div class="card-h"><h3>Recupero de la inversión</h3><div class="seg-ctl">' + [['blue', 'US$ blue'], ['oficial', 'US$ oficial']].map(function(o){ return '<button class="' + (RENT_DOLAR === o[0] ? 'on' : '') + '" onclick="RENT_DOLAR=\'' + o[0] + '\';localStorage.setItem(\'inmoflow_rentdolar\',\'' + o[0] + '\');renderDetalle()">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="v-key"><span><i class="l" style="background:var(--s1)"></i>Neto acumulado (cobros − comisión − gastos)</span><span><i class="l" style="background:var(--ink);opacity:.55"></i>Inversión</span><span><i class="l" style="background:var(--s1);opacity:.5"></i>Proyección</span></div><div class="viz" id="ri-curva"></div></div>' +
    '<div class="card" style="grid-column:1/-1"><h3>Neto por mes en dólar ' + RENT_DOLAR + '</h3><div class="viz" id="ri-mes"></div></div>' +
  '</div>';
}
function graficosInmueble(i){
  var k = RENT_DOLAR === 'blue' ? 'blue' : 'oficial', r = rentabilidad(i);
  // eventos en orden: cobros suman, gastos operativos restan (en US$ de su fecha)
  var ev = [];
  vivos('pagos').filter(function(p){ return p.inmuebleId === i.id; }).forEach(function(p){ ev.push({ fecha: p.fecha, v: usdPago(p, k) * factor(p.distribucion || distribucionInm(i)) }); });
  vivos('gastos').filter(function(g){ return g.inmuebleId === i.id && !g.capital && g.pagadoPor !== 'locatario'; }).forEach(function(g){ ev.push({ fecha: g.fecha, v: -usdGasto(g, k) * factor(g.distribucion || distribucionInm(i)) }); });
  ev.sort(function(a, b){ return a.fecha < b.fecha ? -1 : 1; });
  var acum = 0, pts = [];
  ev.forEach(function(e){ acum += e.v; if (pts.length && pts[pts.length - 1].fecha === e.fecha) pts[pts.length - 1].acum = acum; else pts.push({ fecha: e.fecha, acum: acum }); });
  if (pts.length) pts.unshift({ fecha: addDias(pts[0].fecha, -1), acum: 0 });
  vizRecupero($('ri-curva'), { puntos: pts, meta: k === 'blue' ? r.costoBl : r.costoOf, anual: k === 'blue' ? r.anualBl : r.anualOf });
  // neto por mes, últimos 12
  var meses = []; for (var n = 11; n >= 0; n--) meses.push(perAdd(perHoy(), -n));
  var vals = meses.map(function(m){ return sum(ev.filter(function(e){ return per(e.fecha) === m; }), function(e){ return e.v; }); });
  vizColumnas($('ri-mes'), {
    cats: meses, etiquetas: meses.map(perCorto), barras: { valores: vals, color: 'var(--s1)' }, alto: 180,
    fmtEje: function(v){ return compacto(v, 'US$ '); },
    tip: function(x){ return { titulo: perNom(meses[x]), filas: [{ v: fmtU2(vals[x]), l: 'neto del mes', c: 'var(--s1)' }] }; }
  });
}
function htmlRentab(r){
  if (!r.costoBl && !r.costoOf) return '<div class="hint">Cargá el costo de compra o construcción en la pestaña <b>Costo e inversión</b> para calcular rentabilidad y plazo de amortización.</div>' +
    '<div class="row" style="margin-top:8px"><span class="muted">Neto cobrado acumulado</span><span>' + fmt(r.netoARS) + '</span></div><div class="row"><span class="muted">En dólares</span><span><span class="usd-o">' + fmtU(r.netoOf) + ' of.</span> · <span class="usd-b">' + fmtU(r.netoBl) + ' blue</span></span></div>';
  return '<table><thead><tr><th></th><th class="n">Dólar oficial</th><th class="n">Dólar blue</th></tr></thead><tbody>' +
    '<tr><td>Costo / inversión</td><td class="n usd-o">' + fmtU(r.costoOf) + '</td><td class="n usd-b">' + fmtU(r.costoBl) + '</td></tr>' +
    '<tr><td>Neto acumulado (cobros − comisión − gastos)</td><td class="n">' + fmtU(r.netoOf) + '</td><td class="n">' + fmtU(r.netoBl) + '</td></tr>' +
    '<tr><td>Neto anual' + (r.mesesHist < 12 ? ' <span class="hint">(anualizado de ' + Math.round(r.mesesHist) + ' m)</span>' : '') + '</td><td class="n">' + fmtU(r.anualOf) + '</td><td class="n">' + fmtU(r.anualBl) + '</td></tr>' +
    '<tr><td><b>Rentabilidad anual</b></td><td class="n b">' + pct(r.rentOf, 2) + '</td><td class="n b">' + pct(r.rentBl, 2) + '</td></tr>' +
    '<tr><td>Recuperado</td><td class="n">' + pct(r.recupOf) + '</td><td class="n">' + pct(r.recupBl) + '</td></tr>' +
    '<tr><td>Amortización total</td><td class="n">' + anios(r.paybackOf) + '</td><td class="n">' + anios(r.paybackBl) + '</td></tr>' +
    '<tr><td><b>Falta para recuperar</b></td><td class="n b">' + anios(r.restaOf) + '</td><td class="n b">' + anios(r.restaBl) + '</td></tr>' +
    '</tbody></table>';
}

// costo: lista de partidas (compra, escritura, construcción, mejoras) en pesos o dólares
function detInmCosto(i){
  var c = costoInmueble(i), f = factorInm(i);
  var caps = vivos('gastos').filter(function(g){ return g.inmuebleId === i.id && g.capital; });
  return '<div class="kpis">' + kpi('Costo en pesos (histórico)', fmt(c.ars * f), '') + kpi('Costo en dólar oficial', '<span class="usd-o">' + fmtU(c.of * f) + '</span>', '') + kpi('Costo en dólar blue', '<span class="usd-b">' + fmtU(c.bl * f) + '</span>', '') + '</div>' +
    '<div class="bar"><div class="grow hint">Cargá cada partida en la moneda en que se pagó; InmoFlow la convierte con la cotización de esa fecha. Los gastos marcados como <b>mejora / inversión</b> también suman al costo.</div><button class="btn p" onclick="modalCosto(\'' + i.id + '\')">+ Partida de costo</button></div>' +
    '<div class="tw"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="n">Monto</th><th class="n">TC oficial</th><th class="n">TC blue</th><th class="n">US$ oficial</th><th class="n">US$ blue</th><th></th></tr></thead><tbody>' +
    ((i.costos || []).length || caps.length ? (i.costos || []).map(function(x, k){
      var cof = num(x.cotOf) || cotiz('oficial', x.fecha), cbl = num(x.cotBl) || cotiz('blue', x.fecha);
      var ars = x.moneda === 'ARS' ? num(x.monto) : num(x.monto) * (x.moneda === 'USD_BLUE' ? cbl : cof);
      var uo = x.moneda === 'USD_OF' ? num(x.monto) : cof ? ars / cof : 0, ub = x.moneda === 'USD_BLUE' ? num(x.monto) : cbl ? ars / cbl : 0;
      return '<tr><td>' + fDate(x.fecha) + '</td><td>' + esc(x.concepto) + '</td><td class="n">' + (x.moneda === 'ARS' ? fmt(x.monto) : fmtU(x.monto) + ' <span class="tag ' + (x.moneda === 'USD_BLUE' ? 't-blue">blue' : 't-info">oficial') + '</span>') + '</td><td class="n">' + fmt(cof) + '</td><td class="n">' + fmt(cbl) + '</td><td class="n usd-o">' + fmtU(uo) + '</td><td class="n usd-b">' + fmtU(ub) + '</td><td><button class="btn sm ghost" onclick="modalCosto(\'' + i.id + '\',' + k + ')">Editar</button></td></tr>';
    }).join('') + caps.map(function(g){
      return '<tr class="click" onclick="modalGasto(\'' + g.id + '\')"><td>' + fDate(g.fecha) + '</td><td>' + esc(g.descripcion || g.categoria) + ' <span class="tag t-mut">mejora</span></td><td class="n">' + fmt(g.montoARS) + '</td><td class="n">' + fmt(g.cotOf) + '</td><td class="n">' + fmt(g.cotBl) + '</td><td class="n usd-o">' + fmtU(usdGasto(g, 'oficial')) + '</td><td class="n usd-b">' + fmtU(usdGasto(g, 'blue')) + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">Sin partidas. Ej: “Compra según escritura”, “Construcción (total OBRICK)”, “Escritura y sellos”.</td></tr>') +
    '</tbody></table></div>';
}
function modalCosto(inmId, k){
  var i = byId('inmuebles', inmId), x = k != null ? i.costos[k] : { fecha: hoy(), moneda: 'USD_BLUE', concepto: 'Compra' };
  abrirModal(k != null ? 'Editar partida de costo' : 'Nueva partida de costo',
    '<div class="fr">' + inp('c-fecha', 'Fecha', x.fecha, 'date', 'onchange="costoTC()"') + inp('c-concepto', 'Concepto', x.concepto, 'text', 'list="dl-conc"') + '</div>' +
    '<datalist id="dl-conc"><option>Compra</option><option>Construcción</option><option>Construcción (total OBRICK)</option><option>Escritura y sellos</option><option>Comisión inmobiliaria</option><option>Terreno</option><option>Mejora / ampliación</option></datalist>' +
    '<div class="fr">' + sel('c-moneda', 'Moneda', [['USD_BLUE', 'Dólares (blue / billete)'], ['USD_OF', 'Dólares (oficial)'], ['ARS', 'Pesos']], x.moneda, 'onchange="costoTC()"') + inp('c-monto', 'Monto', x.monto, 'number', 'step="0.01" oninput="costoTC()"') + '</div>' +
    '<div class="fr">' + inp('c-cof', 'TC oficial de esa fecha', x.cotOf || '', 'number', 'step="0.01" oninput="costoTC(1)"') + inp('c-cbl', 'TC blue de esa fecha', x.cotBl || '', 'number', 'step="0.01" oninput="costoTC(1)"') + '</div>' +
    '<div class="calc" id="c-calc"></div><div class="hint" style="margin-top:6px">Las cotizaciones se completan solas con el histórico (ArgentinaDatos). Podés corregirlas si pagaste a otro valor.</div>',
    (k != null ? '<button class="btn d" onclick="borrarCosto(\'' + inmId + '\',' + k + ')">Eliminar</button><span style="flex:1"></span>' : '') +
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" onclick="guardarCosto(\'' + inmId + '\',' + (k != null ? k : 'null') + ')">Guardar</button>');
  costoTC(x.cotOf ? 1 : 0);
}
function costoTC(manual){
  var f = val('c-fecha');
  if (!manual && f) { $('c-cof').value = cotiz('oficial', f) || ''; $('c-cbl').value = cotiz('blue', f) || ''; }
  var m = num(val('c-monto')), mon = val('c-moneda'), of = num(val('c-cof')), bl = num(val('c-cbl'));
  var ars = mon === 'ARS' ? m : m * (mon === 'USD_BLUE' ? bl : of);
  $('c-calc').innerHTML = '<div class="row"><span>En pesos</span><span>' + fmt(ars) + '</span></div><div class="row"><span>En dólar oficial</span><span class="usd-o">' + fmtU(mon === 'USD_OF' ? m : of ? ars / of : 0) + '</span></div><div class="row"><span>En dólar blue</span><span class="usd-b">' + fmtU(mon === 'USD_BLUE' ? m : bl ? ars / bl : 0) + '</span></div>';
}
function guardarCosto(inmId, k){
  var i = byId('inmuebles', inmId);
  var x = { fecha: val('c-fecha'), concepto: val('c-concepto'), moneda: val('c-moneda'), monto: num(val('c-monto')), cotOf: num(val('c-cof')), cotBl: num(val('c-cbl')) };
  if (!x.monto) { toast('Ingresá el monto'); return; }
  i.costos = i.costos || [];
  if (k != null) i.costos[k] = x; else i.costos.push(x);
  guardar('inmuebles', i); cerrarModal(); renderTodo(); toast('Costo guardado');
}
function borrarCosto(inmId, k){ var i = byId('inmuebles', inmId); i.costos.splice(k, 1); guardar('inmuebles', i); cerrarModal(); renderTodo(); }
