// ═══════════════════════════════════════════
// RECIBOS: listado, vista previa, envío y emisión en lote
// Cada recibo nace de un cobro (así queda en la cuenta corriente y la liquidación).
// ═══════════════════════════════════════════
var FILTRO_REC = { desde: perAdd(perHoy(), -1), hasta: perHoy(), q: '' };

function recibosFiltrados(){
  return vivos('pagos').filter(function(p){
    if (p.periodo < FILTRO_REC.desde || p.periodo > FILTRO_REC.hasta) return false;
    if (VISTA !== 'total' && !factor(p.distribucion)) return false;
    var q = FILTRO_REC.q.toLowerCase(); if (!q) return true;
    var c = byId('contratos', p.contratoId);
    return ((c ? etiquetaContrato(c) : '') + ' ' + (p.reciboNro || '')).toLowerCase().indexOf(q) >= 0;
  }).sort(function(a, b){ return (b.fecha + (b.reciboNro || '')) > (a.fecha + (a.reciboNro || '')) ? 1 : -1; });
}
function renderRecibos(){
  var l = recibosFiltrados(), copias = DB.config.reciboCopias || 'dos';
  var sinTel = l.filter(function(p){ var c = byId('contratos', p.contratoId); return !c || !c.locatario.tel; }).length;
  $('p-recibos').innerHTML = '<h2>Recibos</h2><p class="sub">Todos los recibos emitidos. Para emitir uno nuevo se registra el cobro: queda en la cuenta corriente, la liquidación y la rentabilidad.</p>' +
    '<div class="bar"><button class="btn p" onclick="modalPago()">+ Emitir recibo de alquiler</button><button class="btn" onclick="reciboOtroConcepto()">+ Recibo por otro concepto</button><span class="grow"></span>' +
      '<label class="small muted" for="rc-cop">Por hoja</label><select class="f" id="rc-cop" style="width:auto" onchange="DB.config.reciboCopias=this.value;guardarConfig()"><option value="dos"' + (copias === 'dos' ? ' selected' : '') + '>Original + duplicado</option><option value="una"' + (copias === 'una' ? ' selected' : '') + '>Solo original</option></select></div>' +
    '<div class="bar"><input class="f grow" placeholder="Buscar locatario, inmueble o N°…" value="' + esc(FILTRO_REC.q) + '" oninput="FILTRO_REC.q=this.value;renderRecibos();this.focus();this.setSelectionRange(this.value.length,this.value.length)">' +
      '<input class="f" style="width:auto" type="month" value="' + FILTRO_REC.desde + '" onchange="FILTRO_REC.desde=this.value;renderRecibos()"><span class="muted">a</span><input class="f" style="width:auto" type="month" value="' + FILTRO_REC.hasta + '" onchange="FILTRO_REC.hasta=this.value;renderRecibos()">' +
      '<button class="btn" onclick="recibosLote()"' + (l.length ? '' : ' disabled') + '>Todos en un PDF (' + l.length + ')</button></div>' +
    '<div class="kpis">' + kpi('Recibos', l.length, perNom(FILTRO_REC.desde) + (FILTRO_REC.hasta !== FILTRO_REC.desde ? ' a ' + perNom(FILTRO_REC.hasta) : '')) + kpi('Total recibido', fmt(sum(l, totalPago)), '') + kpi('Sin celular cargado', sinTel, sinTel ? 'no se pueden mandar por WhatsApp' : 'todos con WhatsApp') + '</div>' +
    (l.length ? '<div class="tw"><table><thead><tr><th>N°</th><th>Fecha</th><th>Período</th><th>Locatario / inmueble</th><th class="n">Importe</th><th>Medio</th><th></th></tr></thead><tbody>' +
      l.map(function(p){
        var c = byId('contratos', p.contratoId);
        return '<tr class="click" onclick="verRecibo(\'' + p.id + '\')"><td class="b">' + esc(p.reciboNro || '—') + '</td><td>' + fDate(p.fecha) + '</td><td>' + perNom(p.periodo) + '</td><td><b>' + esc(c ? c.locatario.nombre : '—') + '</b><div class="small muted">' + esc(nombreInm(p.inmuebleId)) + '</div></td><td class="n b">' + fmt2(totalPago(p)) + '</td><td class="small">' + esc(p.medio || '') + '</td>' +
          '<td onclick="event.stopPropagation()" style="white-space:nowrap"><button class="btn sm" onclick="verRecibo(\'' + p.id + '\')">Ver</button> <button class="btn sm" onclick="reciboDescargar(\'' + p.id + '\')">PDF</button>' + (c && c.locatario.tel ? ' <button class="btn sm" onclick="reciboWhatsApp(\'' + p.id + '\')">WhatsApp</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card empty">No hay recibos en este rango.</div>');
}
function reciboOtroConcepto(){
  modalPago();
  if (!$('g-alq')) return;
  $('g-alq').value = 0; _pagoExtras = [{ concepto: 'Depósito en garantía', monto: 0, tipo: 'reintegro' }];
  pagoExtrasRender(); pagoCalc();
  document.querySelector('#modal .mh h3').textContent = 'Recibo por otro concepto';
}

// ─── dibujo del recibo ───────────────────────
var REC_COLOR = [15, 118, 110];
function reciboDibujar(doc, p, y0, leyenda, alto){
  var c = byId('contratos', p.contratoId) || { locatario: { nombre: '—' } }, i = byId('inmuebles', p.inmuebleId) || {}, cfg = DB.config;
  var X = 14, W = 182, R = X + W, tot = totalPago(p);
  doc.setDrawColor(210); doc.setLineWidth(0.3); doc.roundedRect(X, y0, W, alto, 3, 3);
  // franja superior
  doc.setFillColor(REC_COLOR[0], REC_COLOR[1], REC_COLOR[2]); doc.roundedRect(X, y0, W, 20, 3, 3, 'F'); doc.rect(X, y0 + 10, W, 10, 'F');
  doc.setFillColor(255, 255, 255); doc.roundedRect(X + 5, y0 + 4, 12, 12, 2, 2, 'F');
  doc.setFillColor(REC_COLOR[0], REC_COLOR[1], REC_COLOR[2]);
  doc.triangle(X + 11, y0 + 6.3, X + 15, y0 + 9.8, X + 7, y0 + 9.8, 'F'); doc.rect(X + 8.3, y0 + 9.6, 5.4, 4.6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text((cfg.emisor || 'InmoFlow'), X + 21, y0 + 9.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(String(cfg.emisorDatos || '') + (cfg.administrador ? '  ·  ' + cfg.administrador : ''), X + 21, y0 + 14.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('RECIBO', R - 5, y0 + 9.5, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('N° ' + (p.reciboNro || ''), R - 5, y0 + 15, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  // fila de datos
  var y = y0 + 27;
  function dato(x, et, v){ doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(et.toUpperCase(), x, y); doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(String(v || '—').slice(0, 42), x, y + 5); doc.setFont('helvetica', 'normal'); }
  dato(X + 5, 'Fecha', fDate(p.fecha)); dato(X + 38, 'Período', perNom(p.periodo)); dato(X + 80, 'Locatario', c.locatario.nombre + (c.locatario.dni ? '  (' + c.locatario.dni + ')' : ''));
  y += 12;
  dato(X + 5, 'Inmueble', (i.direccion ? i.direccion + (i.localidad ? ', ' + i.localidad : '') : i.nombre || ''));
  doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(leyenda, R - 5, y, { align: 'right' }); doc.setTextColor(15, 23, 42);
  y += 11;
  // detalle
  doc.setFillColor(241, 245, 249); doc.rect(X + 5, y - 4, W - 10, 6, 'F');
  doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text('CONCEPTO', X + 7, y); doc.text('IMPORTE', R - 7, y, { align: 'right' });
  doc.setTextColor(15, 23, 42); doc.setFontSize(9.5); y += 6;
  var det = [];
  if (num(p.alquiler)) det.push(['Alquiler ' + perNom(p.periodo), p.alquiler]);
  if (num(p.punitorios)) det.push(['Intereses punitorios por mora', p.punitorios]);
  (p.extras || []).forEach(function(e){ det.push([e.concepto, e.monto]); });
  if (num(p.descuento)) det.push(['Bonificación / descuento', -num(p.descuento)]);
  var maxL = Math.max(1, Math.floor((alto - 92) / 5.2));
  det.slice(0, maxL).forEach(function(d){ doc.text(String(d[0]).slice(0, 70), X + 7, y); doc.text(fmt2(d[1]), R - 7, y, { align: 'right' }); doc.setDrawColor(226, 232, 240); doc.line(X + 5, y + 1.8, R - 5, y + 1.8); y += 5.2; });
  y += 1;
  doc.setFillColor(REC_COLOR[0], REC_COLOR[1], REC_COLOR[2]); doc.roundedRect(R - 70, y - 1, 65, 9, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('TOTAL', R - 67, y + 4.8); doc.text(fmt2(tot), R - 7, y + 4.8, { align: 'right' });
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
  // son pesos
  var yl = y0 + alto - 30;
  doc.setFontSize(8.5);
  var son = doc.splitTextToSize('Recibí la suma de PESOS ' + enLetras(tot) + '.' + (p.medio ? ' Medio de pago: ' + p.medio + '.' : '') + (p.nota ? ' ' + p.nota : ''), 112);
  doc.text(son.slice(0, 3), X + 5, yl);
  var saldo = c.id ? cuentaCorriente(c).saldo : 0;
  doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  doc.text(saldo > 1 ? 'Saldo pendiente a la fecha: ' + fmt2(saldo) : 'Sin saldo pendiente a la fecha.', X + 5, yl + 14);
  doc.text('Documento no válido como factura.', X + 5, yl + 18.5);
  doc.setDrawColor(148, 163, 184); doc.line(R - 62, yl + 13, R - 7, yl + 13);
  doc.text('Firma y aclaración', R - 34.5, yl + 18, { align: 'center' });
  doc.setTextColor(15, 23, 42);
}
// Arma un PDF con uno o varios recibos (original + duplicado por hoja, o solo original).
function reciboDoc(pagos){
  var JS = window.jspdf && window.jspdf.jsPDF; if (!JS) { toast('Cargando generador de PDF… probá de nuevo'); return null; }
  if (!Array.isArray(pagos)) pagos = [pagos];
  var doc = new JS({ unit: 'mm', format: 'a4' }), dos = (DB.config.reciboCopias || 'dos') === 'dos';
  pagos.forEach(function(p, k){
    if (k) doc.addPage();
    if (dos) {
      reciboDibujar(doc, p, 8, 'ORIGINAL', 135);
      doc.setDrawColor(180); doc.setLineDashPattern([1.5, 1.5], 0); doc.line(6, 148.5, 204, 148.5); doc.setLineDashPattern([], 0);
      reciboDibujar(doc, p, 154, 'DUPLICADO', 135);
    } else reciboDibujar(doc, p, 8, 'ORIGINAL', 135);
  });
  return doc;
}
function nombreRecibo(p){ var c = byId('contratos', p.contratoId); return 'Recibo ' + (p.reciboNro || '') + ' ' + (c ? c.locatario.nombre : '') + ' ' + perNom(p.periodo) + '.pdf'; }
function reciboDescargar(id){ var p = byId('pagos', id), d = p && reciboDoc(p); if (d) d.save(nombreRecibo(p)); }
function reciboPDF(id, recienEmitido){ verRecibo(id, recienEmitido); } // compatibilidad con llamadas existentes

var _recUrl = null;
function verRecibo(id, recienEmitido){
  var p = byId('pagos', id); if (!p) return;
  var doc = reciboDoc(p); if (!doc) return;
  var c = byId('contratos', p.contratoId), tel = c && c.locatario.tel, mail = c && c.locatario.email;
  if (_recUrl) URL.revokeObjectURL(_recUrl);
  _recUrl = URL.createObjectURL(doc.output('blob'));
  var puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File([doc.output('blob')], 'r.pdf', { type: 'application/pdf' })] }));
  abrirModal((recienEmitido ? 'Recibo emitido — ' : 'Recibo ') + esc(p.reciboNro || ''),
    '<iframe class="recibo-prev" src="' + _recUrl + '#toolbar=0&navpanes=0&view=FitH" title="Vista previa del recibo"></iframe>' +
    '<div class="hint" style="margin-top:6px">' + esc(c ? c.locatario.nombre : '') + ' · ' + perNom(p.periodo) + ' · ' + fmt2(totalPago(p)) + (tel ? '' : ' · <span style="color:var(--warn)">el locatario no tiene celular cargado</span>') + '</div>',
    '<button class="btn" onclick="cerrarModal();modalPago(\'' + id + '\')">Editar cobro</button><span style="flex:1"></span>' +
    '<button class="btn" onclick="reciboImprimir()">Imprimir</button>' +
    '<button class="btn" onclick="reciboDescargar(\'' + id + '\')">Descargar</button>' +
    (mail ? '<button class="btn" onclick="reciboEmail(\'' + id + '\')">Email</button>' : '') +
    (puedeCompartir ? '<button class="btn p" onclick="reciboCompartir(\'' + id + '\')">Compartir</button>' : '') +
    (tel ? '<button class="btn' + (puedeCompartir ? '' : ' p') + '" onclick="reciboWhatsApp(\'' + id + '\')">WhatsApp</button>' : ''), true);
}
function reciboImprimir(){ var f = document.querySelector('#modal iframe'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.open(_recUrl, '_blank'); } }
function reciboCompartir(id){
  var p = byId('pagos', id), doc = reciboDoc(p);
  var file = new File([doc.output('blob')], nombreRecibo(p), { type: 'application/pdf' });
  navigator.share({ files: [file], title: nombreRecibo(p), text: 'Recibo de alquiler ' + perNom(p.periodo) }).then(function(){ registrarEnvioRecibo(p, 'compartido'); }).catch(function(){});
}
// En celular comparte el PDF directo; en la computadora descarga el PDF y abre el chat para adjuntarlo.
function reciboWhatsApp(id){
  var p = byId('pagos', id), c = byId('contratos', p.contratoId); if (!c || !c.locatario.tel) { toast('Cargá el celular del locatario'); return; }
  var txt = 'Hola ' + titulo(c.locatario.nombre) + ', te enviamos el recibo N° ' + p.reciboNro + ' por ' + fmt2(totalPago(p)) + ' correspondiente a ' + perNom(p.periodo) + '. ¡Gracias!' + '\n' + (DB.config.administrador || '');
  var doc = reciboDoc(p), file = new File([doc.output('blob')], nombreRecibo(p), { type: 'application/pdf' });
  var movil = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (movil && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], text: txt }).then(function(){ registrarEnvioRecibo(p, 'wa'); }).catch(function(){});
    return;
  }
  doc.save(nombreRecibo(p));
  window.open(linkWA(c.locatario.tel, txt), '_blank');
  registrarEnvioRecibo(p, 'wa');
  toast('PDF descargado: adjuntalo en el chat de WhatsApp que se abrió', 5000);
}
function reciboEmail(id){
  var p = byId('pagos', id), c = byId('contratos', p.contratoId);
  reciboDescargar(id);
  location.href = 'mailto:' + c.locatario.email + '?subject=' + encodeURIComponent('Recibo ' + p.reciboNro + ' — alquiler ' + perNom(p.periodo)) + '&body=' + encodeURIComponent('Hola ' + titulo(c.locatario.nombre) + ',\n\nAdjuntamos el recibo N° ' + p.reciboNro + ' por ' + fmt2(totalPago(p)) + ' correspondiente a ' + perNom(p.periodo) + '.\n\nSaludos,\n' + (DB.config.administrador || ''));
  registrarEnvioRecibo(p, 'mail');
  toast('PDF descargado: adjuntalo al email', 5000);
}
function registrarEnvioRecibo(p, canal){
  var c = byId('contratos', p.contratoId); if (!c) return;
  guardar('comunicaciones', { contratoId: c.id, fecha: hoy(), hora: new Date().toTimeString().slice(0, 5), canal: canal, destinatario: c.locatario.nombre, rol: 'Locatario', plantilla: 'recibo', texto: 'Recibo N° ' + p.reciboNro + ' (' + perNom(p.periodo) + ', ' + fmt2(totalPago(p)) + ')' });
}
function recibosLote(){
  var l = recibosFiltrados().slice().reverse(); if (!l.length) return;
  var d = reciboDoc(l); if (d) d.save('Recibos ' + perNom(FILTRO_REC.desde) + (FILTRO_REC.hasta !== FILTRO_REC.desde ? ' a ' + perNom(FILTRO_REC.hasta) : '') + '.pdf');
}
