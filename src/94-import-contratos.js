// ═══════════════════════════════════════════
// Importación de contratos (archivo .json armado a partir de los contratos firmados)
// Se combina con la planilla: los locatarios que están en la planilla usan los mismos
// identificadores (imp-c-…), así se conserva el historial de cobros sin importar el orden.
// ═══════════════════════════════════════════
var TIPO_INM_MAP = { 'Casa': 'Casa', 'Departamento': 'Departamento', 'Dúplex': 'Dúplex', 'Local comercial': 'Local comercial', 'Terreno': 'Terreno', 'Oficina': 'Oficina', 'Cochera': 'Cochera' };

function elegirContratosJSON(){
  var fi = $('fileIn'); fi.multiple = false; fi.accept = '.json,application/json';
  fi.onchange = function(){
    var f = fi.files[0]; fi.value = ''; if (!f) return;
    f.text().then(function(t){
      var d = JSON.parse(t);
      if (d.tipo !== 'inmoflow-contratos' || !Array.isArray(d.contratos)) throw new Error('No es un archivo de contratos de InmoFlow');
      previaContratos(d);
    }).catch(function(e){ alert('No se pudo leer: ' + e.message); });
  };
  fi.click();
}
function idsDeContrato(k){
  return k.planilla ? { inm: 'imp-i-' + k.planilla, ctr: 'imp-c-' + k.planilla }
    : { inm: 'ctr-i-' + slug(k.inmueble.direccion), ctr: 'ctr-c-' + slug(k.locatario.nombre) };
}
function previaContratos(d){
  var nuevosSocios = (d.socios || []).filter(function(s){ return !DB.config.socios.some(function(x){ return x.id === s.id; }); });
  var filas = d.contratos.map(function(k){
    var ids = idsDeContrato(k), existe = !!byId('contratos', ids.ctr);
    return '<tr><td><b>' + esc(k.locatario.nombre) + '</b><div class="small muted">' + esc(k.inmueble.nombre) + '</div></td><td class="small">' + k.titulares.map(function(t){ var s = DB.config.socios.concat(d.socios || []).filter(function(x){ return x.id === t.socioId; })[0]; return esc(s ? s.nombre : t.socioId) + (t.pct < 100 ? ' ' + t.pct + '%' : ''); }).join(' / ') + '</td>' +
      '<td class="small">' + fDate(k.inicio) + ' → ' + fDate(k.fin) + '</td><td class="n">' + fmt(k.monto) + '</td><td class="small">' + esc(k.indice) + ' ' + k.periodicidad + 'm</td>' +
      '<td>' + (existe ? '<span class="tag t-info">completa existente</span>' : '<span class="tag t-ok">nuevo</span>') + (k.observaciones && k.observaciones.length ? ' <span class="tag t-warn" title="' + esc(k.observaciones.join(' · ')) + '">revisar</span>' : '') + '</td></tr>';
  }).join('');
  abrirModal('Importar contratos vigentes',
    '<p><b>' + d.contratos.length + ' contratos</b>' + (nuevosSocios.length ? ' y <b>' + nuevosSocios.length + ' locadores nuevos</b> (' + nuevosSocios.map(function(s){ return esc(s.nombre); }).join(', ') + ')' : '') + '.</p>' +
    '<div class="tw" style="max-height:340px;overflow:auto"><table><thead><tr><th>Locatario / inmueble</th><th>Dueños</th><th>Vigencia</th><th class="n">Monto inicial</th><th>Ajuste</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<div class="calc small" style="margin-top:10px"><b>Cómo se combina:</b> los locatarios que ya vienen de la planilla se completan (DNI, contacto, garantes, dirección, vigencia e índice) y conservan su historial de cobros y montos. ' +
    'Los contratos nuevos arrancan su cuenta corriente en <b>' + perNom(d.ccDesdeNuevos || perHoy()) + '</b> (lo anterior no figura como deuda) y su alquiler actual se <b>estima aplicando el índice</b> desde el inicio: verificalo con lo que efectivamente se cobra. Los puntos marcados “revisar” quedan anotados en cada contrato.</div>',
    '<button class="btn" onclick="cerrarModal()">Cancelar</button><button class="btn p" id="btn-impc">Importar</button>', true);
  $('btn-impc').onclick = function(){ ejecutarImportContratos(d); };
}
function ejecutarImportContratos(d){
  var n = { socios: 0, inmN: 0, inmA: 0, ctrN: 0, ctrA: 0, est: 0 };
  (d.socios || []).forEach(function(s){
    if (DB.config.socios.some(function(x){ return x.id === s.id; })) return;
    DB.config.socios.push(Object.assign({}, s)); n.socios++;
  });
  if (n.socios) guardarConfig();
  var desdeNuevos = d.ccDesdeNuevos || perHoy();
  d.contratos.forEach(function(k){
    var ids = idsDeContrato(k);
    // inmueble
    var inm = byId('inmuebles', ids.inm), nuevoInm = !inm;
    inm = nuevoInm ? { id: ids.inm, costos: [], docs: [], ids: {} } : JSON.parse(JSON.stringify(inm));
    inm.nombre = k.inmueble.nombre; inm.direccion = k.inmueble.direccion; inm.localidad = k.inmueble.localidad || 'Oncativo';
    inm.tipo = TIPO_INM_MAP[k.inmueble.tipo] || 'Otro';
    inm.titulares = k.titulares.map(function(t){ return { socioId: t.socioId, pct: t.pct }; });
    inm.ids = inm.ids || {}; if (k.inmueble.rentas) inm.ids.rentas = k.inmueble.rentas;
    if (k.inmueble.descripcion && (!inm.notas || /Creado al importar la planilla/.test(inm.notas))) inm.notas = k.inmueble.descripcion;
    guardar('inmuebles', inm); nuevoInm ? n.inmN++ : n.inmA++;
    // contrato
    var c = byId('contratos', ids.ctr), nuevoC = !c;
    c = nuevoC ? { id: ids.ctr, docs: [], comisionPct: '', diaVencimiento: DB.config.diaVencimiento } : JSON.parse(JSON.stringify(c));
    c.inmuebleId = ids.inm; c.locatario = Object.assign({}, k.locatario); c.colocatarios = k.colocatarios || [];
    c.garantes = k.garantes || []; c.inicio = k.inicio; c.fin = k.fin; c.indice = k.indice; c.periodicidad = k.periodicidad;
    c.destino = k.destino || 'Vivienda'; c.locadorFormal = k.locadorFormal || ''; c.observaciones = k.observaciones || []; c.archivoContrato = k.archivo;
    if (c.fin >= hoy()) { c.estado = 'vigente'; delete c.fechaFinReal; }
    c.notas = c.notas && !/Importado de la planilla/.test(c.notas) ? c.notas : 'Datos cargados del contrato "' + k.archivo + '".';
    var inicioP = per(k.inicio), ms = montosOrd(c);
    if (!ms.length) ms = [{ desde: inicioP, monto: k.monto, nota: 'Monto inicial según contrato' }];
    else if (ms[0].desde > inicioP) ms.unshift({ desde: inicioP, monto: k.monto, nota: 'Monto inicial según contrato' });
    c.montos = ms;
    if (k.planilla) c.ccDesde = c.ccDesde || (inicioP > '2026-01' ? inicioP : '2026-01');
    else {
      c.ccDesde = c.ccDesde || (inicioP > desdeNuevos ? inicioP : desdeNuevos);
      // alquiler actual estimado: se aplica el índice en cada ajuste ya vencido
      if (nuevoC && ['ICL', 'IPC', 'UVA'].indexOf(k.indice) >= 0) {
        calendarioAjustes(c).filter(function(p){ return p <= perHoy(); }).forEach(function(p){
          if (c.montos.some(function(m){ return m.desde === p; })) return;
          var a = calcularAjuste(c, p);
          if (a.coef > 1) { c.montos.push({ desde: p, monto: a.monto, nota: 'Estimado con ' + k.indice + ' al importar (' + pct((a.coef - 1) * 100, 1) + ') — verificar' }); n.est++; }
        });
      } else if (nuevoC) {
        // sin índice publicado para estimar (Casa Propia / manual): el próximo ajuste es el siguiente a hoy
        var prox = calendarioAjustes(c).filter(function(p){ return p > perHoy(); })[0];
        c.primerAjuste = prox || perAdd(per(k.fin), 1);
      }
    }
    guardar('contratos', c); nuevoC ? n.ctrN++ : n.ctrA++;
  });
  cerrarModal(); renderTodo();
  toast('Listo: ' + n.ctrN + ' contratos nuevos, ' + n.ctrA + ' completados, ' + n.inmN + ' inmuebles nuevos, ' + n.socios + ' locadores nuevos', 6000);
  return n;
}
