// ═══════════════════════════════════════════
// Cotizaciones del dólar e índices de actualización
// Fuentes (públicas, sin clave, con CORS):
//   ArgentinaDatos  /v1/cotizaciones/dolares/{oficial|blue}  → histórico diario (venta)
//   ArgentinaDatos  /v1/finanzas/indices/inflacion           → IPC mensual (INDEC)
//   ArgentinaDatos  /v1/finanzas/indices/uva                 → UVA diario
//   BCRA            /estadisticas/v4.0/monetarias/40         → ICL diario (Ley 27.551)
// ═══════════════════════════════════════════
var COT = { oficial: {}, blue: {}, ts: 0 };
var IDX = { icl: {}, ipc: {}, uva: {}, ts: 0 };

function cargarCacheMercado(){
  try { var c = JSON.parse(localStorage.getItem(LS_COT) || 'null'); if (c) COT = c; } catch (e) {}
  try { var i = JSON.parse(localStorage.getItem(LS_IDX) || 'null'); if (i) IDX = i; } catch (e) {}
}

function actualizarMercado(forzar){
  var viejo = Date.now() - 6 * 3600e3;
  var tareas = [];
  if (forzar || COT.ts < viejo) {
    tareas.push(Promise.all(['oficial', 'blue'].map(function(casa){
      return fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/' + casa).then(function(r){ return r.json(); })
        .then(function(arr){ var m = {}; arr.forEach(function(x){ if (x.fecha >= '2015') m[x.fecha] = x.venta; }); COT[casa] = m; });
    })).then(function(){
      // la cotización del día puede no estar todavía en el histórico: completar con DolarApi
      return fetch('https://dolarapi.com/v1/dolares').then(function(r){ return r.json(); }).then(function(arr){
        arr.forEach(function(x){ if ((x.casa === 'oficial' || x.casa === 'blue') && x.venta) COT[x.casa][hoy()] = COT[x.casa][hoy()] || x.venta; });
      }).catch(function(){});
    }).then(function(){ COT.ts = Date.now(); localStorage.setItem(LS_COT, JSON.stringify(COT)); }));
  }
  if (forzar || IDX.ts < viejo) {
    var desde = '2020-07-01';
    tareas.push(Promise.all([
      // la API del BCRA acepta como máximo limit=3000: se pagina con offset
      (function traerICL(offset, m){
        return fetch('https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/40?desde=' + desde + '&hasta=' + hoy() + '&limit=3000&offset=' + offset).then(function(r){ return r.json(); })
          .then(function(d){
            var det = (d.results && d.results[0] && d.results[0].detalle) || [];
            det.forEach(function(x){ m[x.fecha] = x.valor; });
            var total = d.metadata && d.metadata.resultset ? d.metadata.resultset.count : 0;
            if (det.length && offset + det.length < total) return traerICL(offset + det.length, m);
            if (Object.keys(m).length) IDX.icl = m;
          });
      })(0, {}).catch(function(e){ console.warn('ICL', e); }),
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion').then(function(r){ return r.json(); })
        .then(function(arr){ var m = {}; arr.forEach(function(x){ if (x.fecha >= '2015') m[x.fecha.slice(0, 7)] = x.valor; }); IDX.ipc = m; }).catch(function(e){ console.warn('IPC', e); }),
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/uva').then(function(r){ return r.json(); })
        .then(function(arr){ var m = {}; arr.forEach(function(x){ if (x.fecha >= '2019') m[x.fecha] = x.valor; }); IDX.uva = m; }).catch(function(e){ console.warn('UVA', e); })
    ]).then(function(){ IDX.ts = Date.now(); localStorage.setItem(LS_IDX, JSON.stringify(IDX)); }));
  }
  return Promise.all(tareas);
}

// Valor de una serie diaria en una fecha; si ese día no hay dato (feriado, fin de semana) toma el anterior.
function serieEn(mapa, fecha, maxDias){
  var f = fecha;
  for (var i = 0; i <= (maxDias || 12); i++) {
    if (mapa[f] != null) return { v: mapa[f], fecha: f };
    f = addDias(f, -1);
  }
  return null;
}
function ultimaFecha(mapa){ var k = Object.keys(mapa); return k.length ? k.sort().pop() : null; }
function cotiz(casa, fecha){
  var f = fecha > hoy() ? hoy() : fecha;
  var r = serieEn(COT[casa] || {}, f, 15);
  if (!r) { var u = ultimaFecha(COT[casa] || {}); if (u && f > u) r = { v: COT[casa][u], fecha: u }; }
  return r ? r.v : 0;
}
function cotizHoy(){ return { oficial: cotiz('oficial', hoy()), blue: cotiz('blue', hoy()) }; }

// ─── contratos: montos, ajustes y estado ─────
var INDICES = {
  ICL: 'ICL (BCRA) — Ley 27.551',
  IPC: 'IPC (INDEC)',
  UVA: 'UVA (BCRA)',
  CASA_PROPIA: 'Casa Propia (manual)',
  FIJO: 'Porcentaje fijo',
  MANUAL: 'Manual / a convenir',
  NINGUNO: 'Sin actualización'
};

function contratoActivo(c, p){
  p = p || perHoy();
  if (c.deleted || c.estado === 'rescindido' && c.fechaRescision && per(c.fechaRescision) < p) return false;
  return per(c.inicio) <= p && (!c.fin || per(c.fin) >= p) && c.estado !== 'finalizado';
}
function montosOrd(c){ return (c.montos || []).slice().sort(function(a, b){ return a.desde < b.desde ? -1 : 1; }); }
function montoVigente(c, p){
  var ms = montosOrd(c), m = 0;
  for (var i = 0; i < ms.length; i++) if (ms[i].desde <= p) m = num(ms[i].monto);
  if (!m && ms.length) m = num(ms[0].monto);
  return m;
}
function ultimoTramo(c, p){ var ms = montosOrd(c), t = ms[0]; ms.forEach(function(x){ if (x.desde <= p) t = x; }); return t; }

// Calendario de ajustes: primerAjuste + k·periodicidad, hasta el fin del contrato.
function calendarioAjustes(c){
  var n = +c.periodicidad || 0;
  if (!n || c.indice === 'NINGUNO') return [];
  var p = c.primerAjuste || perAdd(per(c.inicio), n), fin = c.fin ? per(c.fin) : perAdd(perHoy(), 36), out = [];
  for (var k = 0; k < 60 && p <= fin; k++) { out.push(p); p = perAdd(p, n); }
  return out;
}
function proximoAjuste(c){
  var ya = (c.montos || []).map(function(m){ return m.desde; });
  var cal = calendarioAjustes(c);
  for (var i = 0; i < cal.length; i++) if (ya.indexOf(cal[i]) < 0) return cal[i];
  return null;
}

// Calcula el nuevo monto para el ajuste del período p. Devuelve {monto, coef, detalle, estimado}
function calcularAjuste(c, p){
  var anterior = perAdd(p, -1), base = montoVigente(c, anterior), tramo = ultimoTramo(c, anterior);
  var desde = tramo ? tramo.desde : per(c.inicio), n = +c.periodicidad || perDiff(desde, p);
  var dia = c.inicio ? c.inicio.slice(8, 10) : '01';
  var res = { base: base, coef: 1, detalle: '', estimado: false, monto: base };
  if (c.indice === 'ICL' || c.indice === 'UVA') {
    var mapa = c.indice === 'ICL' ? IDX.icl : IDX.uva;
    var fa = desde + '-' + dia, fb = p + '-' + dia, ult = ultimaFecha(mapa);
    if (!ult) { res.detalle = 'Sin datos de ' + c.indice + ' (sin conexión)'; res.estimado = true; return res; }
    if (fb > ult) { fb = ult; res.estimado = true; }
    var va = serieEn(mapa, fa), vb = serieEn(mapa, fb);
    if (!va || !vb) { res.detalle = 'Faltan valores de ' + c.indice; res.estimado = true; return res; }
    res.coef = vb.v / va.v;
    res.detalle = c.indice + ' ' + fDate(va.fecha) + ': ' + va.v.toLocaleString('es-AR') + ' → ' + fDate(vb.fecha) + ': ' + vb.v.toLocaleString('es-AR');
  } else if (c.indice === 'IPC') {
    // IPC de los n meses previos con desfase de un mes (el IPC de mes anterior se publica a mediados del mes).
    var desf = c.ipcDesfase == null ? 1 : +c.ipcDesfase, coef = 1, usados = [];
    for (var i = n; i >= 1; i--) {
      var m = perAdd(p, -i - desf), v = IDX.ipc[m];
      if (v == null) { res.estimado = true; var ks = Object.keys(IDX.ipc).sort(); v = ks.length ? IDX.ipc[ks[ks.length - 1]] : 0; usados.push(perCorto(m) + ' ~' + v + '%'); }
      else usados.push(perCorto(m) + ' ' + v + '%');
      coef *= 1 + v / 100;
    }
    res.coef = coef;
    res.detalle = 'IPC: ' + usados.join(' · ');
  } else if (c.indice === 'FIJO') {
    res.coef = 1 + num(c.pctFijo) / 100;
    res.detalle = 'Aumento fijo ' + pct(c.pctFijo);
  } else {
    res.detalle = 'Índice manual: cargá el nuevo monto';
    res.estimado = true;
  }
  res.monto = Math.round(base * res.coef);
  return res;
}

// ─── pagos ───────────────────────────────────
function pagosDe(contratoId){ return vivos('pagos').filter(function(p){ return p.contratoId === contratoId; }); }
function ingresoPago(p){ return num(p.alquiler) + num(p.punitorios) + sum((p.extras || []).filter(function(e){ return e.tipo !== 'reintegro'; }), function(e){ return e.monto; }); }
function totalPago(p){ return num(p.alquiler) + num(p.punitorios) + sum(p.extras || [], function(e){ return e.monto; }) - num(p.descuento); }
function netoPago(p){ return ingresoPago(p) - num(p.descuento) - num(p.comision); }

function distribucionInm(inm){
  var t = (inm && inm.titulares && inm.titulares.length) ? inm.titulares : [{ socioId: DB.config.socios[0].id, pct: 100 }];
  return t;
}
// fracción que le toca a la "vista" actual (total o un socio)
var VISTA = localStorage.getItem('inmoflow_vista') || 'total';
function factor(dist){
  if (VISTA === 'total') return 1;
  var d = (dist || []).find(function(x){ return x.socioId === VISTA; });
  return d ? num(d.pct) / 100 : 0;
}
function factorInm(inm){ return factor(distribucionInm(inm)); }
function nombreSocio(id){ var s = DB.config.socios.find(function(x){ return x.id === id; }); return s ? s.nombre : id; }

// Cuenta corriente: por cada mes del contrato, lo que se debía y lo que se pagó.
function cuentaCorriente(c){
  var desde = per(c.inicio), hasta = perHoy();
  if (c.fin && per(c.fin) < hasta) hasta = per(c.fin);
  if (c.estado === 'finalizado' && c.fechaFinReal) hasta = per(c.fechaFinReal);
  var pagos = pagosDe(c.id), filas = [], saldo = 0, dv = +c.diaVencimiento || DB.config.diaVencimiento || 10;
  for (var p = desde, k = 0; p <= hasta && k < 240; p = perAdd(p, 1), k++) {
    var deb = montoVigente(c, p);
    var ps = pagos.filter(function(x){ return x.periodo === p; });
    var pag = sum(ps, function(x){ return x.alquiler; });
    saldo += deb - pag;
    var venc = p + '-' + p2(Math.min(dv, 28));
    var est = pag >= deb - 1 ? 'pagado' : pag > 0 ? 'parcial' : (hoy() > venc ? 'vencido' : 'pendiente');
    filas.push({ periodo: p, debe: deb, pagado: pag, saldo: saldo, estado: est, pagos: ps, venc: venc });
  }
  return { filas: filas, saldo: saldo };
}
function deudaContrato(c){ return cuentaCorriente(c).filas.filter(function(f){ return f.estado === 'vencido' || f.estado === 'parcial'; }); }

// Punitorios sugeridos por mora (interés diario sobre el alquiler adeudado).
function punitorioSugerido(c, periodo, fechaPago, monto){
  var dv = +c.diaVencimiento || DB.config.diaVencimiento || 10, venc = periodo + '-' + p2(Math.min(dv, 28));
  var dias = diasEntre(venc, fechaPago);
  var tasa = c.punitorioPct != null && c.punitorioPct !== '' ? num(c.punitorioPct) : num(DB.config.punitorioDiarioPct);
  if (dias <= 0 || !tasa) return { dias: 0, monto: 0 };
  return { dias: dias, monto: Math.round(monto * tasa / 100 * dias) };
}

// ─── costo, gastos y rentabilidad ────────────
function costoInmueble(inm){
  var o = { ars: 0, of: 0, bl: 0 };
  (inm.costos || []).forEach(function(x){
    var cof = num(x.cotOf) || cotiz('oficial', x.fecha), cbl = num(x.cotBl) || cotiz('blue', x.fecha);
    var ars = x.moneda === 'ARS' ? num(x.monto) : num(x.monto) * (x.moneda === 'USD_BLUE' ? cbl : cof);
    o.ars += ars;
    if (x.moneda === 'USD_OF') { o.of += num(x.monto); o.bl += cbl ? ars / cbl : 0; }
    else if (x.moneda === 'USD_BLUE') { o.bl += num(x.monto); o.of += cof ? ars / cof : 0; }
    else { o.of += cof ? ars / cof : 0; o.bl += cbl ? ars / cbl : 0; }
  });
  vivos('gastos').forEach(function(g){
    if (g.inmuebleId !== inm.id || !g.capital) return;
    o.ars += num(g.montoARS); o.of += usdGasto(g, 'oficial'); o.bl += usdGasto(g, 'blue');
  });
  return o;
}
function gastoARS(g){ return g.moneda === 'USD' ? num(g.monto) * (num(g.cotBl) || cotiz('blue', g.fecha)) : num(g.monto); }
function usdGasto(g, casa){
  var c = casa === 'blue' ? (num(g.cotBl) || cotiz('blue', g.fecha)) : (num(g.cotOf) || cotiz('oficial', g.fecha));
  if (g.moneda === 'USD') return num(g.monto);
  return c ? num(g.montoARS || g.monto) / c : 0;
}
function usdPago(p, casa){
  var c = casa === 'blue' ? (num(p.cotBl) || cotiz('blue', p.fecha)) : (num(p.cotOf) || cotiz('oficial', p.fecha));
  return c ? netoPago(p) / c : 0;
}

function rentabilidad(inm){
  var f = factorInm(inm), costo = costoInmueble(inm);
  var desde12 = addDias(hoy(), -365);
  var pagos = vivos('pagos').filter(function(p){ return p.inmuebleId === inm.id; });
  var gastos = vivos('gastos').filter(function(g){ return g.inmuebleId === inm.id && !g.capital && g.pagadoPor !== 'locatario'; });
  var r = {
    costoARS: costo.ars * f, costoOf: costo.of * f, costoBl: costo.bl * f,
    brutoARS: 0, comisionARS: 0, gastosARS: 0, netoARS: 0,
    netoOf: 0, netoBl: 0, neto12Of: 0, neto12Bl: 0, neto12ARS: 0, bruto12ARS: 0, gastos12Of: 0, gastos12Bl: 0,
    meses: {}
  };
  pagos.forEach(function(p){
    var fp = factor(p.distribucion || distribucionInm(inm));
    var of = usdPago(p, 'oficial') * fp, bl = usdPago(p, 'blue') * fp;
    r.brutoARS += ingresoPago(p) * fp; r.comisionARS += num(p.comision) * fp; r.netoARS += netoPago(p) * fp;
    r.netoOf += of; r.netoBl += bl;
    if (p.fecha >= desde12) { r.neto12Of += of; r.neto12Bl += bl; r.neto12ARS += netoPago(p) * fp; r.bruto12ARS += ingresoPago(p) * fp; }
    var m = per(p.fecha); r.meses[m] = (r.meses[m] || 0) + bl;
  });
  gastos.forEach(function(g){
    var fg = factor(g.distribucion || distribucionInm(inm));
    var of = usdGasto(g, 'oficial') * fg, bl = usdGasto(g, 'blue') * fg;
    r.gastosARS += num(g.montoARS || gastoARS(g)) * fg;
    r.netoOf -= of; r.netoBl -= bl;
    if (g.fecha >= desde12) { r.neto12Of -= of; r.neto12Bl -= bl; r.gastos12Of += of; r.gastos12Bl += bl; r.neto12ARS -= num(g.montoARS) * fg; }
    var m = per(g.fecha); r.meses[m] = (r.meses[m] || 0) - bl;
  });
  // Rentabilidad anualizada: si hay menos de 12 meses de historia, se anualiza lo que hay.
  var primer = pagos.reduce(function(a, p){ return !a || p.fecha < a ? p.fecha : a; }, null);
  var mesesHist = primer ? Math.min(12, Math.max(1, diasEntre(primer, hoy()) / 30.4 + 1)) : 0;
  r.mesesHist = mesesHist;
  r.anualOf = mesesHist ? r.neto12Of * 12 / mesesHist : 0;
  r.anualBl = mesesHist ? r.neto12Bl * 12 / mesesHist : 0;
  r.rentOf = r.costoOf ? r.anualOf / r.costoOf * 100 : 0;
  r.rentBl = r.costoBl ? r.anualBl / r.costoBl * 100 : 0;
  r.recupOf = r.costoOf ? r.netoOf / r.costoOf * 100 : 0;
  r.recupBl = r.costoBl ? r.netoBl / r.costoBl * 100 : 0;
  r.paybackOf = r.anualOf > 0 ? r.costoOf / r.anualOf : null;            // años totales
  r.paybackBl = r.anualBl > 0 ? r.costoBl / r.anualBl : null;
  r.restaOf = r.anualOf > 0 ? Math.max(0, (r.costoOf - r.netoOf) / r.anualOf) : null; // años que faltan
  r.restaBl = r.anualBl > 0 ? Math.max(0, (r.costoBl - r.netoBl) / r.anualBl) : null;
  return r;
}
function anios(x){
  if (x == null) return '—';
  if (x < 1) return Math.round(x * 12) + ' meses';
  var a = Math.floor(x), m = Math.round((x - a) * 12);
  if (m === 12) { a++; m = 0; }
  return a + (a === 1 ? ' año' : ' años') + (m ? ' ' + m + ' m' : '');
}

// ─── número a letras (recibos) ───────────────
function enLetras(n){
  n = Math.round(num(n) * 100) / 100;
  var ent = Math.floor(n), cent = Math.round((n - ent) * 100);
  var U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function cien(x){
    if (x === 0) return '';
    if (x === 100) return 'cien';
    var c = Math.floor(x / 100), r = x % 100, s = C[c];
    if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : ''));
    return s;
  }
  function mil(x){
    var m = Math.floor(x / 1000), r = x % 1000, s = '';
    if (m) s = (m === 1 ? 'mil' : cien(m).replace(/uno$/, 'un') + ' mil');
    if (r) s += (s ? ' ' : '') + cien(r);
    return s;
  }
  function todo(x){
    if (x === 0) return 'cero';
    var mm = Math.floor(x / 1e6), r = x % 1e6, s = '';
    if (mm) s = mm === 1 ? 'un millón' : mil(mm).replace(/uno$/, 'un') + ' millones';
    if (r) s += (s ? ' ' : '') + mil(r);
    return s;
  }
  var txt = todo(ent).replace(/uno$/, 'un');
  return (txt + (cent ? ' con ' + p2(cent) + '/100' : '')).toUpperCase();
}
