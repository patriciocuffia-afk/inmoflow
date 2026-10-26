// ═══════════════════════════════════════════
// AJUSTES, importación, backup e inicio
// ═══════════════════════════════════════════
function renderAjustes(){
  if (soloLectura()) { renderMiCuenta(); return; }
  var cfg = DB.config, pls = cfg.plantillas;
  var uCot = ultimaFecha(COT.blue || {}), uIcl = ultimaFecha(IDX.icl || {}), uIpc = Object.keys(IDX.ipc || {}).sort().pop();
  var cuenta = conFirebase()
    ? '<div class="card"><h3>Sesión</h3><p>Ingresaste como <b>' + esc(quienSoy()) + '</b> (' + esc(USUARIO ? USUARIO.email : '') + ') · <span class="tag t-ok">Administrador</span></p><p class="small muted">Los datos se guardan en Firestore (proyecto <b>' + esc(FB.projectId) + '</b>) con reglas de seguridad, y los archivos en Google Drive, carpeta <b>InmoFlow</b>.</p>' +
      '<button class="btn" onclick="sincronizar(true)">Sincronizar ahora</button> <button class="btn" onclick="salir()">Cerrar sesión</button><div class="hint" style="margin-top:8px">' + Object.keys(PENDIENTES).length + ' cambio(s) sin subir.</div></div>'
    : '<div class="card"><h3>Cuenta de Google (sincronización)</h3>' +
      (AUTH_TOKEN ? '<p><span class="tag t-ok">Conectado</span> Los datos se guardan en Firestore (proyecto <b>' + PROJECT_ID + '</b>) y los archivos en tu Google Drive, carpeta <b>InmoFlow</b>.</p><button class="btn" onclick="sincronizar(true)">Sincronizar ahora</button> <button class="btn" onclick="desconectarGoogle()">Desconectar</button>'
        : '<p>Ahora los datos están <b>solo en este dispositivo</b>. Conectá tu cuenta de Google para compartirlos y no perderlos.</p><button class="btn p" onclick="conectarGoogle()">Conectar con Google</button>') +
      '<div class="hint" style="margin-top:10px">Modo provisorio: para separar permisos por dueño hay que activar Firebase (ver SEGURIDAD.md). ' + Object.keys(PENDIENTES).length + ' cambio(s) sin subir.</div></div>';
  $('p-ajustes').innerHTML = '<h2>Ajustes</h2><p class="sub">Usuarios y permisos, configuración general, socios, plantillas, sincronización e importación.</p><div class="grid g2">' +
    htmlUsuariosCard() + cuenta +
    '<div class="card"><h3>Administración y recibos</h3>' +
      '<div class="fr">' + inp('s-emisor', 'Emisor del recibo', cfg.emisor) + inp('s-emdat', 'Datos (domicilio, CUIT, tel.)', cfg.emisorDatos) + '</div>' +
      '<div class="fr">' + inp('s-adm', 'Nombre del administrador', cfg.administrador) + inp('s-pv', 'Punto de venta', cfg.reciboPuntoVenta) + inp('s-nro', 'Próximo N° de recibo', cfg.reciboNro, 'number') + '</div>' +
      '<div class="fr">' + inp('s-com', 'Comisión administrador %', cfg.comisionPct, 'number', 'step="0.01"') + sel('s-comb', 'Se calcula sobre', [['alquiler', 'Solo el alquiler'], ['total', 'Alquiler + punitorios + ingresos']], cfg.comisionBase) + '</div>' +
      '<div class="fr">' + inp('s-pun', 'Punitorio diario %', cfg.punitorioDiarioPct, 'number', 'step="0.01"') + inp('s-dv', 'Día de vencimiento', cfg.diaVencimiento, 'number') + inp('s-avaj', 'Avisar ajustes con (días)', cfg.avisoAjusteDias, 'number') + inp('s-avve', 'Avisar fin de contrato con (días)', cfg.avisoVencimientoDias, 'number') + '</div>' +
      '<div class="fr">' + txa('s-pago', 'Datos para pagar (los ven los locatarios): alias, CBU, titular', cfg.datosPago) + '</div><div class="fr">' + inp('s-tel', 'Teléfono de la administración', cfg.telAdministracion, 'tel') + '</div>' +
      '<button class="btn p" onclick="guardarAjustes()">Guardar</button></div>' +
    '<div class="card"><h3>Socios / copropietarios</h3><div id="s-socios">' + cfg.socios.map(function(s, k){ return '<div class="lines"><div class="ln" style="grid-template-columns:1fr 32px"><input class="f" value="' + esc(s.nombre) + '" onchange="DB.config.socios[' + k + '].nombre=this.value;guardarConfig();renderTabs()"><span></span></div></div>'; }).join('') + '</div>' +
      '<button class="btn sm" onclick="agregarSocio()">+ Socio</button><div class="hint" style="margin-top:8px">El porcentaje de cada uno se define en cada inmueble. Con el selector “Vista” de arriba ves todo como lo ve cada socio.</div></div>' +
    '<div class="card"><h3>Cotizaciones e índices</h3><div class="kv"><div>Dólar oficial / blue</div><div>' + fmt(cotizHoy().oficial) + ' / ' + fmt(cotizHoy().blue) + ' <span class="hint">(' + (uCot ? fDate(uCot) : 'sin datos') + ')</span></div><div>ICL (BCRA)</div><div>' + (uIcl ? IDX.icl[uIcl] + ' <span class="hint">(' + fDate(uIcl) + ')</span>' : 'sin datos') + '</div><div>IPC último</div><div>' + (uIpc ? IDX.ipc[uIpc] + '% <span class="hint">(' + perNom(uIpc) + ')</span>' : 'sin datos') + '</div></div>' +
      '<button class="btn sm" style="margin-top:10px" onclick="actualizarMercado(true).then(function(){toast(\'Actualizado\');renderTodo()})">Actualizar ahora</button><div class="hint" style="margin-top:6px">Fuentes: ArgentinaDatos, DolarApi y API del BCRA. Se actualizan solas cada 6 horas.</div></div>' +
    '<div class="card"><h3>Notificaciones</h3><p class="small">InmoFlow te avisa al abrirla cuando hay ajustes, deudas o contratos por vencer.</p>' +
      ('Notification' in window ? (Notification.permission === 'granted' ? '<span class="tag t-ok">Activadas</span>' : '<button class="btn" onclick="Notification.requestPermission().then(function(){renderAjustes();notificarSiCorresponde()})">Activar notificaciones</button>') : '') + '</div>' +
    '<div class="card"><h3>Importar planilla de alquileres</h3><p class="small">Descargá la planilla de Google Sheets como Excel (Archivo → Descargar → .xlsx) y elegila. Se crean los contratos con su historial de cobros mes a mes y el próximo reajuste. Se pueden reimportar meses nuevos sin duplicar.</p><button class="btn p" onclick="elegirPlanilla()">Elegir .xlsx</button></div>' +
    '<div class="card"><h3>Importar contratos vigentes</h3><p class="small">Archivo <b>.json</b> con los datos de los contratos firmados (partes, garantes, inmueble, vigencia, precio e índice). Completa los contratos que vienen de la planilla sin perder sus cobros y crea los demás. Se puede importar antes o después de la planilla.</p><button class="btn p" onclick="elegirContratosJSON()">Elegir .json</button> <button class="btn" onclick="elegirArchivosContratos()">Adjuntar los .docx firmados</button><div class="hint" style="margin-top:6px">Elegí todos los archivos de la carpeta de contratos juntos: cada uno se adjunta a su contrato por el nombre.</div></div>' +
    '<div class="card"><h3>Backup</h3><p class="small">Copia completa de los datos (sin los archivos, que quedan en Drive).</p><button class="btn" onclick="exportarBackup()">Descargar backup</button> <button class="btn" onclick="importarBackup()">Restaurar backup</button> <button class="btn" onclick="exportarExcel(\'todo\')">Exportar a Excel</button></div>' +
    '<div class="card"><h3>Categorías de gastos</h3><textarea class="f" id="s-cats" style="min-height:150px">' + esc(cfg.categoriasGasto.join('\n')) + '</textarea><button class="btn sm" style="margin-top:8px" onclick="DB.config.categoriasGasto=val(\'s-cats\').split(\'\\n\').map(function(s){return s.trim()}).filter(Boolean);guardarConfig();toast(\'Categorías guardadas\')">Guardar</button></div>' +
    '<div class="card" style="grid-column:1/-1"><h3>Plantillas de mensajes</h3><p class="hint">Variables: {locatario} {garante} {inmueble} {periodo} {monto} {vencimiento} {montoAnterior} {montoNuevo} {desde} {indice} {deuda} {detalleDeuda} {fin} {ultimoPago} {ultimoPeriodo} {firma}</p>' +
      Object.keys(pls).map(function(k){ return '<div style="margin-bottom:10px"><label class="l">' + esc(pls[k].nombre) + '</label><textarea class="f" onchange="DB.config.plantillas[\'' + k + '\'].texto=this.value;guardarConfig();toast(\'Plantilla guardada\')">' + esc(pls[k].texto) + '</textarea></div>'; }).join('') +
      '<button class="btn sm" onclick="if(confirm(\'¿Volver a las plantillas originales?\')){DB.config.plantillas=plantillasBase();guardarConfig();renderAjustes()}">Restaurar originales</button></div>' +
    htmlActividad() +
    '</div><p class="hint" style="margin-top:16px">InmoFlow versión ' + APP_VERSION + '</p>';
  pintarUsuarios();
}
function guardarAjustes(){
  var c = DB.config;
  c.emisor = val('s-emisor'); c.emisorDatos = val('s-emdat'); c.administrador = val('s-adm'); c.reciboPuntoVenta = val('s-pv') || '0001'; c.reciboNro = num(val('s-nro')) || 1;
  c.comisionPct = num(val('s-com')); c.comisionBase = val('s-comb'); c.punitorioDiarioPct = num(val('s-pun')); c.diaVencimiento = num(val('s-dv')) || 10;
  c.datosPago = val('s-pago'); c.telAdministracion = val('s-tel');
  c.avisoAjusteDias = num(val('s-avaj')) || 30; c.avisoVencimientoDias = num(val('s-avve')) || 60;
  guardarConfig(); toast('Ajustes guardados'); renderTodo();
}
function agregarSocio(){ var n = prompt('Nombre del socio / copropietario:'); if (!n) return; DB.config.socios.push({ id: uid(), nombre: n }); guardarConfig(); renderTodo(); }

// ─── backup ──────────────────────────────────
function descargar(nombre, contenido, tipo){
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo || 'application/json' })); a.download = nombre; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}
function exportarBackup(){
  var d = { app: 'InmoFlow', version: APP_VERSION, fecha: new Date().toISOString(), config: DB.config };
  COLS.forEach(function(c){ d[c] = DB[c]; });
  descargar('inmoflow-backup-' + hoy() + '.json', JSON.stringify(d, null, 1));
}
function importarBackup(){
  var fi = $('fileIn'); fi.multiple = false; fi.accept = '.json,application/json';
  fi.onchange = function(){
    var f = fi.files[0]; fi.value = ''; if (!f) return;
    f.text().then(function(t){
      var d = JSON.parse(t); if (d.app !== 'InmoFlow') throw new Error('No es un backup de InmoFlow');
      var n = 0;
      COLS.forEach(function(c){ (d[c] || []).forEach(function(rem){ var i = DB[c].findIndex(function(x){ return x.id === rem.id; }); if (i < 0 || (rem.updatedAt || 0) > (DB[c][i].updatedAt || 0)) { if (i < 0) DB[c].push(rem); else DB[c][i] = rem; PENDIENTES[c + '/' + rem.id] = true; n++; } }); });
      if (d.config && (d.config.updatedAt || 0) > (DB.config.updatedAt || 0)) { DB.config = Object.assign(configBase(), d.config); PENDIENTES['config/config'] = true; }
      guardarLocal(); programarSync(); renderTodo(); toast(n + ' registros restaurados');
    }).catch(function(e){ alert('No se pudo restaurar: ' + e.message); });
  };
  fi.click();
}
function exportarExcel(que){
  if (!window.XLSX) { toast('Cargando Excel…'); return; }
  var wb = XLSX.utils.book_new();
  function hoja(nombre, filas){ XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombre); }
  if (que === 'pagos' || que === 'todo') hoja('Cobros', vivos('pagos').sort(function(a, b){ return a.fecha < b.fecha ? -1 : 1; }).map(function(p){
    var c = byId('contratos', p.contratoId);
    return { Recibo: p.reciboNro, Fecha: p.fecha, Periodo: p.periodo, Locatario: c ? c.locatario.nombre : '', Inmueble: nombreInm(p.inmuebleId), Alquiler: p.alquiler, Punitorios: p.punitorios, Otros: sum(p.extras || [], function(e){ return e.monto; }), Descuento: p.descuento, Total: totalPago(p), Comision: p.comision, Neto: netoPago(p), 'TC oficial': p.cotOf, 'TC blue': p.cotBl, 'US$ oficial': r2(usdPago(p, 'oficial')), 'US$ blue': r2(usdPago(p, 'blue')), Medio: p.medio, Reparto: (p.distribucion || []).map(function(d){ return nombreSocio(d.socioId) + ' ' + d.pct + '%'; }).join(' / ') };
  }));
  if (que === 'gastos' || que === 'todo') hoja('Gastos', vivos('gastos').sort(function(a, b){ return a.fecha < b.fecha ? -1 : 1; }).map(function(g){
    return { Fecha: g.fecha, Inmueble: nombreInm(g.inmuebleId), Categoria: g.categoria, Descripcion: g.descripcion, Proveedor: g.proveedor, Moneda: g.moneda, Monto: g.monto, Pesos: g.montoARS, 'US$ oficial': r2(usdGasto(g, 'oficial')), 'US$ blue': r2(usdGasto(g, 'blue')), Pago: g.pagadoPor, Mejora: g.capital ? 'Sí' : '' };
  }));
  if (que === 'todo') {
    hoja('Contratos', vivos('contratos').map(function(c){ return { Locatario: c.locatario.nombre, DNI: c.locatario.dni, Tel: c.locatario.tel, Inmueble: nombreInm(c.inmuebleId), Inicio: c.inicio, Fin: c.fin, 'Monto actual': montoVigente(c, perHoy()), Indice: c.indice, 'Cada (meses)': c.periodicidad, 'Proximo ajuste': proximoAjuste(c) || '', Estado: estadoContrato(c), Garantes: (c.garantes || []).map(function(g){ return g.nombre; }).join(', ') }; }));
    hoja('Rentabilidad', vivos('inmuebles').map(function(i){ var r = rentabilidad(i); return { Inmueble: i.nombre, 'Costo US$ blue': r2(r.costoBl), 'Costo US$ oficial': r2(r.costoOf), 'Neto acum. US$ blue': r2(r.netoBl), 'Neto anual US$ blue': r2(r.anualBl), 'Rentab. % blue': r2(r.rentBl), 'Rentab. % oficial': r2(r.rentOf), 'Recuperado % blue': r2(r.recupBl), 'Años que faltan (blue)': r.restaBl == null ? '' : r2(r.restaBl) }; }));
  }
  XLSX.writeFile(wb, 'InmoFlow ' + (que === 'todo' ? 'completo' : que) + ' ' + hoy() + '.xlsx');
}

// ─── importación de la planilla mensual ──────
// Formato: una hoja por mes ("OCTUBRE 2026"), fila 2 con los socios ("BENJAMIN", "PATRICIO")
// y por cada socio: nombre del locatario, nota, importe y columna REAJUSTE.
function elegirPlanilla(){
  if (!window.XLSX) { toast('Cargando lector de Excel…'); return; }
  var fi = $('fileIn'); fi.multiple = false; fi.accept = '.xlsx,.xls';
  fi.onchange = function(){ var f = fi.files[0]; fi.value = ''; if (f) f.arrayBuffer().then(function(b){ importarPlanilla(XLSX.read(b, { type: 'array' })); }).catch(function(e){ alert('No se pudo leer: ' + e.message); }); };
  fi.click();
}
function sinAcentos(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function mesDeTexto(t, perRef){
  // celdas con formato fecha llegan como número de serie de Excel (días desde 30/12/1899)
  if (typeof t === 'number' || /^\d{5}(\.\d+)?$/.test(String(t).trim())) {
    var n = +t; if (n > 30000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 7);
    return null;
  }
  var s =sinAcentos(t).toLowerCase().replace('septimbre', 'septiembre').replace('setiembre', 'septiembre');
  for (var m = 0; m < 12; m++) {
    if (s.indexOf(sinAcentos(MESES[m]).toLowerCase()) >= 0) {
      var y = (s.match(/20\d\d/) || [])[0];
      if (y) return y + '-' + p2(m + 1);
      var cand = perRef.slice(0, 4) + '-' + p2(m + 1);
      return cand < perRef ? perAdd(cand, 12) : cand;
    }
  }
  return null;
}
function limpiarNombre(n){ return String(n || '').replace(/\(.*$/, '').replace(/\b\d+\/\d+\s*mes\b/i, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function slug(s){ return sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function analizarPlanilla(wb){
  var meses = [], datos = {}; // datos[nombre] = { meses: {per: {socioId: monto, nota, reaj}} }
  wb.SheetNames.forEach(function(sn){
    var p = mesDeTexto(sn, '2000-01'); var y = (sn.match(/20\d\d/) || [])[0];
    if (!p || !y) return;
    p = y + p.slice(4);
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
    var hdr = null, hi = -1;
    for (var r = 0; r < Math.min(6, rows.length); r++) if (rows[r].some(function(x){ return /BENJAMIN|PATRICIO/i.test(sinAcentos(x)); })) { hdr = rows[r]; hi = r; break; }
    if (!hdr) return;
    var bloques = [];
    DB.config.socios.forEach(function(s){
      var col = hdr.findIndex(function(x){ var h = sinAcentos(x).toUpperCase().trim(); return h && (h === sinAcentos(s.alias || '').toUpperCase() || sinAcentos(s.nombre).toUpperCase().split(/\s+/).indexOf(h) >= 0); });
      if (col < 0) return;
      var reaj = -1; for (var c = col + 1; c < hdr.length; c++) { if (/REAJUSTE/i.test(hdr[c])) { reaj = c; break; } if (c > col + 4) break; }
      bloques.push({ socio: s.id, nom: col, nota: col + 1, monto: col + 2, reaj: reaj });
    });
    if (!bloques.length) return;
    meses.push(p);
    bloques.forEach(function(b){
      for (var r = hi + 1; r < rows.length; r++) {
        var nomRaw = String(rows[r][b.nom] || '').trim();
        if (/TOTAL/i.test(nomRaw)) break;
        var monto = num(rows[r][b.monto]);
        if (!nomRaw || !monto) continue;
        var nom = limpiarNombre(nomRaw);
        var nota = [String(rows[r][b.nota] || '').trim(), (nomRaw.match(/\(.*$/) || [''])[0], (nomRaw.match(/\d+\/\d+\s*mes/i) || [''])[0]].filter(Boolean).join(' ');
        var d = datos[nom] = datos[nom] || { meses: {} };
        var m = d.meses[p] = d.meses[p] || { socios: {}, nota: '', reaj: '' };
        m.socios[b.socio] = (m.socios[b.socio] || 0) + monto;
        if (nota) m.nota = (m.nota ? m.nota + ' ' : '') + nota;
        if (b.reaj >= 0 && rows[r][b.reaj] && !m.reaj) m.reaj = typeof rows[r][b.reaj] === 'number' ? rows[r][b.reaj] : String(rows[r][b.reaj]).trim();
      }
    });
  });
  meses.sort();
  return { meses: meses, datos: datos };
}
function importarPlanilla(wb){
  var a = analizarPlanilla(wb), nombres = Object.keys(a.datos).sort();
  if (!a.meses.length) { alert('No encontré hojas con el formato esperado (una hoja por mes con columnas por socio).'); return; }
  var ultimo = a.meses[a.meses.length - 1];
  abrirModal('Importar planilla',
    '<p>Encontré <b>' + a.meses.length + ' meses</b> (' + perNom(a.meses[0]) + ' a ' + perNom(ultimo) + ') y <b>' + nombres.length + ' locatarios</b>.</p>' +
    '<div class="tw" style="max-height:300px;overflow:auto"><table><thead><tr><th>Locatario</th><th>Meses</th><th class="n">Último total</th><th>Reparto</th><th>Próx. reajuste</th></tr></thead><tbody>' +
    nombres.map(function(n){
      var ps = Object.keys(a.datos[n].meses).sort(), u = a.datos[n].meses[ps[ps.length - 1]], tot = sum(Object.keys(u.socios), function(k){ return u.socios[k]; });
      return '<tr><td>' + esc(n) + (ps[ps.length - 1] < ultimo ? ' <span class="tag t-mut">finalizado</span>' : '') + '</td><td>' + ps.length + '</td><td class="n">' + fmt(tot) + '</td><td class="small">' + Object.keys(u.socios).map(function(k){ return esc(nombreSocio(k)) + ' ' + Math.round(u.socios[k] / tot * 100) + '%'; }).join(' / ') + '</td><td>' + (u.reaj ? (mesDeTexto(u.reaj, ultimo) ? perNom(mesDeTexto(u.reaj, ultimo)) : esc(u.reaj)) : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="calc small" style="margin-top:10px"><b>Cómo se interpreta:</b> cuando un locatario figura en las dos columnas, el alquiler total es la suma y cada socio cobra su parte (ej. mitad y mitad). Se aplica la comisión del administrador configurada (' + pct(DB.config.comisionPct, 2) + ') y la fecha de cobro el día 10 de cada mes, cobrado por la administración. Se crea un inmueble por locatario para que después le pongas la dirección (o lo reasignes). El índice queda como <b>IPC cada 4 meses</b>: revisalo en cada contrato.</div>',
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" id="btn-imp">Importar</button>', true);
  $('btn-imp').onclick = function(){ ejecutarImportacion(a); };
}
function ejecutarImportacion(a){
  var ultimo = a.meses[a.meses.length - 1], nI = 0, nC = 0, nP = 0;
  Object.keys(a.datos).forEach(function(nom){
    var d = a.datos[nom], ps = Object.keys(d.meses).sort(), s = slug(nom);
    var u = d.meses[ps[ps.length - 1]], totU = sum(Object.keys(u.socios), function(k){ return u.socios[k]; });
    var titulares = Object.keys(u.socios).map(function(k){ return { socioId: k, pct: r2(u.socios[k] / totU * 100) }; });
    var dif = 100 - sum(titulares, function(t){ return t.pct; }); titulares[0].pct = r2(titulares[0].pct + dif);
    var inmId = 'imp-i-' + s, ctrId = 'imp-c-' + s;
    if (!byId('inmuebles', inmId)) { guardar('inmuebles', { id: inmId, nombre: 'Inmueble de ' + titulo(nom), tipo: 'Departamento', titulares: titulares, ids: {}, costos: [], docs: [], notas: 'Creado al importar la planilla. Completá dirección, cuentas y costo.' }); nI++; }
    var c = byId('contratos', ctrId), nuevo = !c;
    if (nuevo) c = { id: ctrId, inmuebleId: inmId, locatario: { nombre: titulo(nom) }, garantes: [], indice: 'IPC', periodicidad: 4, ipcDesfase: 1, diaVencimiento: DB.config.diaVencimiento, comisionPct: '', docs: [], destino: 'Vivienda', notas: 'Importado de la planilla. Verificá índice, fechas y datos del locatario.' };
    // si el contrato ya se cargó desde el documento firmado, su fecha de inicio manda (puede ser una renovación)
    if (!c.archivoContrato) c.inicio = c.inicio && c.inicio <= ps[0] + '-01' ? c.inicio : ps[0] + '-01';
    // tramos de monto: cada vez que cambia el total, salvo meses parciales (notas con "días" o "1/2 mes")
    var montos = [], prev = null;
    ps.forEach(function(p){
      var m = d.meses[p], tot = sum(Object.keys(m.socios), function(k){ return m.socios[k]; });
      if (/d[ií]as|1\/2|mes\s*\+/i.test(m.nota) && montos.length) return;
      if (tot !== prev) { montos.push({ desde: p, monto: tot, nota: prev == null ? 'Monto según planilla' : 'Actualización según planilla' }); prev = tot; }
    });
    if (nuevo || !(c.montos || []).length) c.montos = montos;
    else if (c.archivoContrato) {
      // dentro del contrato, lo que figura en la planilla es lo que efectivamente se cobró: reemplaza o completa
      montos.forEach(function(m){ if (m.desde < per(c.inicio)) return; var ex = c.montos.filter(function(x){ return x.desde === m.desde; })[0]; if (ex) { ex.monto = m.monto; ex.nota = m.nota; } else c.montos.push(m); });
    }
    else montos.forEach(function(m){ if (!c.montos.some(function(x){ return x.desde === m.desde; }) && m.desde > montosOrd(c).slice(-1)[0].desde) c.montos.push(m); });
    var pr = u.reaj ? mesDeTexto(u.reaj, ultimo) : null;
    // sin dato de reajuste: se estima desde el último cambio de monto (si no, el calendario arrancaría en enero y daría falsos atrasos)
    if (!pr && c.periodicidad) { var ult = montosOrd(c).slice(-1)[0]; pr = perAdd(ult ? ult.desde : ps[0], c.periodicidad); while (pr <= ultimo) pr = perAdd(pr, c.periodicidad); }
    if (pr && (nuevo || !c.primerAjuste || c.primerAjuste < pr)) c.primerAjuste = pr;
    if (!c.ccDesde || c.ccDesde > ps[0]) c.ccDesde = ps[0] > per(c.inicio) ? ps[0] : per(c.inicio); // la planilla empieza en enero: lo anterior no es deuda
    if (ps[ps.length - 1] < ultimo) { c.estado = 'finalizado'; c.fechaFinReal = finDeMes(ps[ps.length - 1]); }
    else if (nuevo) c.estado = 'vigente';
    guardar('contratos', c); if (nuevo) nC++;
    ps.forEach(function(p){
      var pid = 'imp-p-' + s + '-' + p; if (byId('pagos', pid)) return;
      var m = d.meses[p], tot = sum(Object.keys(m.socios), function(k){ return m.socios[k]; });
      var fecha = p + '-10'; if (fecha > hoy()) fecha = hoy();
      var dist = Object.keys(m.socios).map(function(k){ return { socioId: k, pct: r2(m.socios[k] / tot * 100) }; });
      guardar('pagos', { id: pid, contratoId: ctrId, inmuebleId: inmId, periodo: p, fecha: fecha, alquiler: tot, punitorios: 0, descuento: 0, extras: [], medio: 'Planilla', recibio: [{ quien: 'admin', monto: tot }], comisionPct: num(DB.config.comisionPct), comision: r2(tot * num(DB.config.comisionPct) / 100), cotOf: cotiz('oficial', fecha), cotBl: cotiz('blue', fecha), distribucion: dist, reciboNro: 'PLAN-' + p, nota: m.nota || '' });
      nP++;
    });
  });
  cerrarModal(); renderTodo();
  toast('Importados: ' + nI + ' inmuebles, ' + nC + ' contratos, ' + nP + ' cobros', 5000);
}

// ─── inicio ──────────────────────────────────
function chequearVersion(){
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r){ return r.json(); })
    .then(function(j){ if (j && j.v && j.v !== APP_VERSION) $('upd').style.display = 'block'; }).catch(function(){});
}
function init(){
  cargarLocal();
  cargarCacheMercado();
  var h = (location.hash || '').slice(1);
  if (TABS.some(function(t){ return t[0] === h; }) || h === 'mensajes' || h === 'mialquiler') PAGINA = h;
  if (DB.config.socios.every(function(s){ return s.id !== VISTA; })) VISTA = 'total';
  if (conFirebase()) {
    // Sesión guardada: entra directo (el token se renueva solo). Si no, pantalla de ingreso.
    fbCargarSes();
    var u = null; try { u = JSON.parse(localStorage.getItem('inmoflow_usuario') || 'null'); } catch (e) {}
    if (FB_SES && u && u.email === FB_SES.email) {
      USUARIO = u; if (u.rol !== 'admin') VISTA = u.socioId;
      ir(PAGINA); setSync('busy', 'Conectando…');
      fbCargarPerfil().then(function(){ return sincronizar(true); }).then(provisionarUsuariosIniciales).then(renderTodo).catch(function(e){ mostrarLogin(e.message); });
    } else { ir(PAGINA); mostrarLogin(); }
  } else ir(PAGINA);
  if (conFirebase()) {}
  else if (tokenGuardado()) { setSync('busy', 'Conectando…'); sincronizar(true); }
  else if (localStorage.getItem('inmoflow_google')) {
    setSync('err', 'Reconectar');
    // GIS carga asíncrono: reintenta el login silencioso cuando esté disponible
    var intentos = 0, t = setInterval(function(){ if (window.google && google.accounts) { clearInterval(t); conectarGoogle(true); } else if (++intentos > 20) clearInterval(t); }, 500);
  }
  actualizarMercado(false).then(function(){ renderTodo(); notificarSiCorresponde(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function(){});
  chequearVersion(); setInterval(chequearVersion, 30 * 60e3);
  iniciarChat();
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') cerrarModal(); });
}
window.addEventListener('DOMContentLoaded', init);
