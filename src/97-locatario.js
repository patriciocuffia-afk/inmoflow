// ═══════════════════════════════════════════
// Vista del LOCATARIO: su alquiler, su cuenta, sus recibos y su contrato. Nada más.
// (El servidor solo le entrega su contrato y sus cobros; ver firestore.rules.)
// ═══════════════════════════════════════════
function inmDeContrato(c){
  var i = byId('inmuebles', c.inmuebleId);
  return i ? { nombre: i.nombre, direccion: i.direccion || '', localidad: i.localidad || '' } : (c._inm || { nombre: '', direccion: '', localidad: '' });
}
function renderMiAlquiler(){
  var cid = contratoDelUsuario(), c = cid ? byId('contratos', cid) : null;
  if (!c) {
    $('p-mialquiler').innerHTML = '<h2>Mi alquiler</h2><div class="card empty">Todavía no aparecen los datos de tu contrato.<br>Si recién te dieron acceso, tocá el indicador de arriba a la derecha para actualizar, o escribile a la administración.<br><button class="btn p" style="margin-top:10px" onclick="ir(\'mensajes\')">Escribir a la administración</button></div>';
    return;
  }
  var ph = perHoy(), inm = inmDeContrato(c), cc = cuentaCorriente(c);
  var f = cc.filas.filter(function(x){ return x.periodo === ph; })[0];
  var deuda = sum(deudaContrato(c), function(x){ return x.debe - x.pagado; }), pa = proximoAjuste(c);
  var dv = c.diaVencimiento || DB.config.diaVencimiento || 10, cfg = DB.config;
  var h = '<h2>Mi alquiler</h2><p class="sub">' + esc([inm.direccion || inm.nombre, inm.localidad].filter(Boolean).join(', ')) + '</p>' +
    '<div class="kpis">' +
      kpi('Alquiler de ' + perNom(ph).split(' ')[0].toLowerCase(), fmt(montoVigente(c, ph)), f ? tagEstado(f.estado) : '') +
      kpi('Se paga', 'del 1 al ' + dv, 'de cada mes, por adelantado') +
      kpi('Saldo', deuda > 0 ? '<span class="neg-v">' + fmt(deuda) + '</span>' : 'Al día', deuda > 0 ? deudaContrato(c).map(function(x){ return perNom(x.periodo); }).join(', ') : 'sin deuda') +
      kpi('Próxima actualización', pa ? perNom(pa) : '—', pa ? 'según ' + esc((INDICES[c.indice] || c.indice).replace(/ —.*$/, '')) : '') +
    '</div>' +
    '<div class="grid g2">' +
      '<div class="card"><h3>Cómo pagar</h3>' +
        (cfg.datosPago ? '<div style="white-space:pre-wrap" class="b">' + esc(cfg.datosPago) + '</div>' : '<div class="hint">Consultá a la administración los datos para transferir.</div>') +
        '<p class="small muted" style="margin-bottom:0">Después de transferir, mandá el comprobante por el chat: así se registra el pago y te llega el recibo.</p>' +
        '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" onclick="ir(\'mensajes\')">Escribir a la administración</button></div></div>' +
      '<div class="card"><h3>Mi contrato</h3><div class="kv">' +
        '<div>Inmueble</div><div>' + esc(inm.direccion || inm.nombre) + '</div>' +
        '<div>Vigencia</div><div>' + fDate(c.inicio) + ' al ' + fDate(c.fin) + '</div>' +
        '<div>Actualización</div><div>' + esc((INDICES[c.indice] || c.indice).replace(/ —.*$/, '')) + (c.periodicidad ? ', cada ' + c.periodicidad + ' meses' : '') + '</div>' +
        '<div>Locatario</div><div>' + esc(c.locatario.nombre) + (c.colocatarios && c.colocatarios.length ? ' y ' + c.colocatarios.map(function(x){ return esc(x.nombre); }).join(', ') : '') + '</div>' +
        '<div>Garantes</div><div>' + ((c.garantes || []).map(function(g){ return esc(g.nombre); }).join('<br>') || '—') + '</div>' +
        '<div>Administra</div><div>' + esc(cfg.administrador || '') + '</div>' +
      '</div>' +
      ((c.docs || []).length ? '<div class="liq-sec">Documentos</div>' + c.docs.map(function(d, k){ return '<div class="row"><span>' + esc(d.nombre) + '</span><span><a href="#" onclick="abrirDoc(\'contratos\',\'' + c.id + '\',' + k + ');return false">abrir</a></span></div>'; }).join('') : '') +
      '</div>' +
    '</div>' +
    '<h3 style="margin-top:18px">Mis pagos y recibos</h3>' +
    '<div class="tw"><table><thead><tr><th>Mes</th><th class="n">Alquiler</th><th class="n">Pagado</th><th>Estado</th><th>Recibo</th></tr></thead><tbody>' +
      cc.filas.slice().reverse().map(function(x){
        return '<tr><td><b>' + perNom(x.periodo) + '</b></td><td class="n">' + fmt(x.debe) + '</td><td class="n">' + fmt(x.pagado) + '</td><td>' + tagEstado(x.estado) + '</td>' +
          '<td>' + x.pagos.map(function(p){ return '<button class="btn sm" onclick="verRecibo(\'' + p.id + '\')">' + (/^PLAN/.test(p.reciboNro || '') ? 'Ver' : 'N° ' + esc(p.reciboNro || '')) + '</button>'; }).join(' ') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  $('p-mialquiler').innerHTML = h;
}
