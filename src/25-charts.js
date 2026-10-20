// ═══════════════════════════════════════════
// Gráficos SVG livianos (sin librerías): columnas + línea, barras horizontales,
// barra de estado y curva de recupero. Todos con tooltip al pasar el mouse / tocar.
// Colores por rol (ver CSS --s1, --s2, --st-*); los textos usan tinta, nunca el color de la serie.
// ═══════════════════════════════════════════
var _vizTip = null, _vizRender = {};
function vizTip(){
  if (_vizTip) return _vizTip;
  _vizTip = document.createElement('div'); _vizTip.className = 'vtip'; document.body.appendChild(_vizTip);
  return _vizTip;
}
// filas: [{v:'$ 1.234', l:'Neto', c:'var(--s1)', linea:true}]
function vizMostrar(ev, titulo, filas){
  var t = vizTip(); t.textContent = '';
  var h = document.createElement('div'); h.className = 'vtip-h'; h.textContent = titulo; t.appendChild(h);
  filas.forEach(function(f){
    var r = document.createElement('div'); r.className = 'vtip-r';
    if (f.c) { var k = document.createElement('i'); k.className = f.linea ? 'k-l' : 'k-b'; k.style.background = f.c; r.appendChild(k); }
    var v = document.createElement('b'); v.textContent = f.v; r.appendChild(v);
    var l = document.createElement('span'); l.textContent = f.l; r.appendChild(l);
    t.appendChild(r);
  });
  t.style.display = 'block';
  var x = ev.clientX, y = ev.clientY, w = t.offsetWidth, hh = t.offsetHeight;
  var left = x + 14 + w > window.innerWidth - 8 ? x - w - 14 : x + 14;
  t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, y - hh - 12) + 'px';
}
function vizOcultar(){ if (_vizTip) _vizTip.style.display = 'none'; }
document.addEventListener('scroll', vizOcultar, true);

function svgEl(tag, attrs, parent){
  var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function svgTxt(parent, x, y, txt, attrs){ var t = svgEl('text', Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = txt; return t; }
function niceMax(v){
  if (v <= 0) return 1;
  var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
function compacto(n, pref){
  var a = Math.abs(n), s = n < 0 ? '−' : '';
  var t = a >= 1e6 ? (a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : a >= 1e3 ? Math.round(a / 1e3).toLocaleString('es-AR') + ' mil' : Math.round(a).toLocaleString('es-AR');
  return s + (pref || '') + t;
}
// Re-dibuja al cambiar el ancho del contenedor
var _vizRO = window.ResizeObserver ? new ResizeObserver(function(entries){
  entries.forEach(function(en){ var f = _vizRender[en.target.id]; if (f && en.target.isConnected) f(); });
}) : null;
function vizMontar(el, fn){
  if (!el) return;
  if (!el.id) el.id = 'viz-' + uid();
  _vizRender[el.id] = fn; fn();
  if (_vizRO && !el._obs) { _vizRO.observe(el); el._obs = true; }
}

// ─── columnas (una serie) + línea opcional (misma unidad, un solo eje) ───
// o = { cats:[...], etiquetas:[...], barras:{nombre, valores, color}, linea:{nombre, valores, color}|null,
//       fmtEje(n), tip(i) -> {titulo, filas}, alto, destacar:i }
function vizColumnas(el, o){
  vizMontar(el, function(){
    el.textContent = '';
    var W = Math.max(260, el.clientWidth), H = o.alto || 220, m = { t: 14, r: 8, b: 26, l: 48 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.cats.length;
    var todos = o.barras.valores.concat(o.linea ? o.linea.valores : []);
    var max = niceMax(Math.max.apply(null, todos.concat([0]))), min = Math.min(0, Math.min.apply(null, todos));
    if (min < 0) min = -niceMax(-min);
    var y = function(v){ return m.t + ih - (v - min) / (max - min) * ih; };
    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' }, el);
    var g = svgEl('g', {}, svg);
    for (var k = 0; k <= 4; k++) {
      var v = min + (max - min) * k / 4, yy = Math.round(y(v)) + .5;
      svgEl('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: v === 0 ? 'v-base' : 'v-grid' }, g);
      svgTxt(g, m.l - 8, yy + 4, o.fmtEje ? o.fmtEje(v) : compacto(v), { class: 'v-tick', 'text-anchor': 'end' });
    }
    var bw = iw / n, barW = Math.min(24, bw * 0.62), y0 = y(0);
    var paso = Math.ceil(n / Math.max(1, Math.floor(iw / 44)));
    o.cats.forEach(function(c, i){
      var cx = m.l + bw * i + bw / 2;
      if (i % paso === 0 || i === n - 1) svgTxt(g, cx, H - 8, o.etiquetas ? o.etiquetas[i] : c, { class: 'v-tick', 'text-anchor': 'middle' });
      var val = o.barras.valores[i], top = y(Math.max(0, val)), bot = y(Math.min(0, val)), h = Math.max(0, bot - top);
      if (h > 0.5) {
        var r = Math.min(4, h, barW / 2), x = cx - barW / 2, d;
        if (val >= 0) d = 'M' + x + ',' + bot + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top + 'H' + (x + barW - r) + 'Q' + (x + barW) + ',' + top + ' ' + (x + barW) + ',' + (top + r) + 'V' + bot + 'Z';
        else d = 'M' + x + ',' + top + 'V' + (bot - r) + 'Q' + x + ',' + bot + ' ' + (x + r) + ',' + bot + 'H' + (x + barW - r) + 'Q' + (x + barW) + ',' + bot + ' ' + (x + barW) + ',' + (bot - r) + 'V' + top + 'Z';
        svgEl('path', { d: d, fill: o.barras.color, class: 'v-bar' + (o.destacar === i ? ' on' : ''), 'data-i': i }, g);
      }
    });
    if (o.linea) {
      var pts = o.linea.valores.map(function(v, i){ return [m.l + bw * i + bw / 2, y(v)]; });
      svgEl('path', { d: 'M' + pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'), fill: 'none', stroke: o.linea.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      var u = pts[pts.length - 1];
      svgEl('circle', { cx: u[0], cy: u[1], r: 4, fill: o.linea.color, class: 'v-dot' }, g);
    }
    // capa de hover: una franja por categoría (más grande que la barra)
    var hl = svgEl('rect', { x: 0, y: m.t, width: bw, height: ih, class: 'v-hl', visibility: 'hidden' }, g);
    o.cats.forEach(function(c, i){
      var hit = svgEl('rect', { x: m.l + bw * i, y: m.t, width: bw, height: ih + m.b, fill: 'transparent', tabindex: 0, 'aria-label': o.etiquetas ? o.etiquetas[i] : c }, svg);
      function on(ev){ hl.setAttribute('x', m.l + bw * i); hl.setAttribute('visibility', 'visible'); var t = o.tip(i); if (ev.clientX == null) { var b = hit.getBoundingClientRect(); ev = { clientX: b.left + b.width / 2, clientY: b.top + 30 }; } vizMostrar(ev, t.titulo, t.filas); }
      hit.addEventListener('pointermove', on); hit.addEventListener('focus', on);
      hit.addEventListener('pointerleave', function(){ hl.setAttribute('visibility', 'hidden'); vizOcultar(); });
      hit.addEventListener('blur', function(){ hl.setAttribute('visibility', 'hidden'); vizOcultar(); });
      if (o.click) { hit.style.cursor = 'pointer'; hit.addEventListener('click', function(){ vizOcultar(); o.click(i); }); }
    });
  });
}

// ─── barras horizontales ordenadas: items [{label, valor, texto, tip:{titulo,filas}, click}] ───
function vizBarrasH(el, items, color){
  vizMontar(el, function(){
    el.textContent = '';
    if (!items.length) { el.innerHTML = '<div class="empty">Sin datos</div>'; return; }
    var W = Math.max(260, el.clientWidth), fila = 30, m = { t: 4, r: 70, l: Math.min(190, Math.max(100, W * 0.34)) };
    var H = m.t + items.length * fila + 4, iw = W - m.l - m.r;
    var max = Math.max.apply(null, items.map(function(x){ return x.valor; }).concat([0.0001]));
    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }, el);
    svgEl('line', { x1: m.l + .5, x2: m.l + .5, y1: m.t, y2: H - 4, class: 'v-base' }, svg);
    items.forEach(function(it, i){
      var yy = m.t + i * fila, bh = 14, w = Math.max(0, it.valor) / max * iw, by = yy + (fila - bh) / 2;
      var lab = it.label.length > 28 ? it.label.slice(0, 27) + '…' : it.label;
      svgTxt(svg, m.l - 8, by + 11, lab, { class: 'v-lab', 'text-anchor': 'end' });
      if (w > 0.5) {
        var r = Math.min(4, w / 2);
        svgEl('path', { d: 'M' + m.l + ',' + by + 'H' + (m.l + w - r) + 'Q' + (m.l + w) + ',' + by + ' ' + (m.l + w) + ',' + (by + r) + 'V' + (by + bh - r) + 'Q' + (m.l + w) + ',' + (by + bh) + ' ' + (m.l + w - r) + ',' + (by + bh) + 'H' + m.l + 'Z', fill: it.color || color, class: 'v-bar' }, svg);
      }
      svgTxt(svg, m.l + w + 6, by + 11, it.texto, { class: 'v-val' });
      var hit = svgEl('rect', { x: 0, y: yy, width: W, height: fila, fill: 'transparent', tabindex: 0, class: 'v-rowhit' }, svg);
      if (it.tip) {
        var on = function(ev){ if (ev.clientX == null) { var b = hit.getBoundingClientRect(); ev = { clientX: b.left + m.l + w, clientY: b.top + 10 }; } vizMostrar(ev, it.tip.titulo, it.tip.filas); };
        hit.addEventListener('pointermove', on); hit.addEventListener('focus', on);
        hit.addEventListener('pointerleave', vizOcultar); hit.addEventListener('blur', vizOcultar);
      }
      if (it.click) { hit.style.cursor = 'pointer'; hit.addEventListener('click', function(){ vizOcultar(); it.click(); }); }
    });
  });
}

// ─── barra de estado (parte de un todo): segs [{label, valor, color, icono, texto}] ───
function vizEstado(el, segs, total){
  el.textContent = '';
  var tot = total || sum(segs, function(s){ return s.valor; });
  var bar = document.createElement('div'); bar.className = 'v-stack'; el.appendChild(bar);
  segs.forEach(function(s){
    if (!s.valor) return;
    var d = document.createElement('div'); d.className = 'v-seg'; d.style.flex = String(s.valor / (tot || 1)); d.style.background = s.color; d.tabIndex = 0;
    var on = function(ev){ if (ev.clientX == null) { var b = d.getBoundingClientRect(); ev = { clientX: b.left + b.width / 2, clientY: b.top }; } vizMostrar(ev, s.label, [{ v: s.texto, l: Math.round(s.valor / (tot || 1) * 100) + '% del mes', c: s.color }]); };
    d.addEventListener('pointermove', on); d.addEventListener('focus', on); d.addEventListener('pointerleave', vizOcultar); d.addEventListener('blur', vizOcultar);
    bar.appendChild(d);
  });
  var lg = document.createElement('div'); lg.className = 'v-legend'; el.appendChild(lg);
  segs.forEach(function(s){
    var it = document.createElement('span'); it.className = 'v-li';
    var sw = document.createElement('i'); sw.style.background = s.color; it.appendChild(sw);
    var ic = document.createElement('b'); ic.textContent = (s.icono ? s.icono + ' ' : '') + s.label; it.appendChild(ic);
    var tx = document.createElement('span'); tx.textContent = ' ' + s.texto; it.appendChild(tx);
    lg.appendChild(it);
  });
}

// ─── curva de recupero: neto acumulado en US$ vs inversión, con proyección ───
// o = { puntos:[{fecha, acum}], meta, anual, moneda:'blue'|'oficial' }
function vizRecupero(el, o){
  vizMontar(el, function(){
    el.textContent = '';
    var pts = o.puntos; if (!pts.length || !o.meta) { el.innerHTML = '<div class="empty">Cargá el costo y registrá cobros para ver la curva de recupero.</div>'; return; }
    var W = Math.max(260, el.clientWidth), H = 230, m = { t: 16, r: 14, b: 26, l: 56 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var f0 = new Date(pts[0].fecha + 'T12:00').getTime(), ult = pts[pts.length - 1];
    var fFin = new Date(ult.fecha + 'T12:00').getTime(), proy = null;
    if (o.anual > 0 && ult.acum < o.meta) {
      var anios2 = (o.meta - ult.acum) / o.anual, fp = fFin + anios2 * 365.25 * 864e5;
      proy = { t: fp, fecha: new Date(fp).toISOString().slice(0, 10) };
    }
    var t1 = Math.max(proy ? proy.t : fFin, f0 + 864e5 * 60);
    var max = niceMax(Math.max(o.meta, ult.acum) * 1.05);
    var x = function(t){ return m.l + (t - f0) / (t1 - f0) * iw; }, y = function(v){ return m.t + ih - Math.max(0, v) / max * ih; };
    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }, el);
    for (var k = 0; k <= 4; k++) { var vv = max * k / 4, yy = Math.round(y(vv)) + .5; svgEl('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: k ? 'v-grid' : 'v-base' }, svg); svgTxt(svg, m.l - 8, yy + 4, compacto(vv, 'US$ '), { class: 'v-tick', 'text-anchor': 'end' }); }
    var y1 = new Date(f0).getFullYear(), y2 = new Date(t1).getFullYear(), pasoA = Math.max(1, Math.ceil((y2 - y1 + 1) / Math.max(1, Math.floor(iw / 50))));
    for (var a = y1 + 1; a <= y2; a += pasoA) { var xa = x(new Date(a + '-01-01T12:00').getTime()); if (xa > m.l + 10 && xa < W - m.r - 10) svgTxt(svg, xa, H - 8, String(a), { class: 'v-tick', 'text-anchor': 'middle' }); }
    // meta (inversión)
    var ym = Math.round(y(o.meta)) + .5;
    svgEl('line', { x1: m.l, x2: W - m.r, y1: ym, y2: ym, class: 'v-meta' }, svg);
    svgTxt(svg, m.l + 6, ym - 6, 'Inversión ' + fmtU(o.meta), { class: 'v-lab' });
    // área + línea real
    var p = pts.map(function(q){ return [x(new Date(q.fecha + 'T12:00').getTime()), y(q.acum)]; });
    var linea = 'M' + p.map(function(q){ return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L');
    svgEl('path', { d: linea + 'L' + p[p.length - 1][0].toFixed(1) + ',' + y(0) + 'L' + p[0][0].toFixed(1) + ',' + y(0) + 'Z', fill: 'var(--s1)', 'fill-opacity': .1 }, svg);
    if (proy) svgEl('line', { x1: p[p.length - 1][0], y1: p[p.length - 1][1], x2: x(proy.t), y2: y(o.meta), class: 'v-proy' }, svg);
    svgEl('path', { d: linea, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    var u = p[p.length - 1];
    svgEl('circle', { cx: u[0], cy: u[1], r: 4.5, fill: 'var(--s1)', class: 'v-dot' }, svg);
    if (proy) { svgEl('circle', { cx: x(proy.t), cy: y(o.meta), r: 4.5, class: 'v-dot v-dot-proy' }, svg); svgTxt(svg, Math.min(x(proy.t), W - m.r - 4), y(o.meta) + 16, 'Recupero ~' + perNom(per(proy.fecha)), { class: 'v-lab', 'text-anchor': 'end' }); }
    // crosshair
    var ch = svgEl('line', { y1: m.t, y2: m.t + ih, class: 'v-cross', visibility: 'hidden' }, svg);
    var hit = svgEl('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', function(ev){
      var bx = svg.getBoundingClientRect(), mx = ev.clientX - bx.left, best = 0;
      p.forEach(function(q, i){ if (Math.abs(q[0] - mx) < Math.abs(p[best][0] - mx)) best = i; });
      var enProy = proy && mx > u[0] + 12;
      ch.setAttribute('x1', enProy ? x(proy.t) : p[best][0]); ch.setAttribute('x2', enProy ? x(proy.t) : p[best][0]); ch.setAttribute('visibility', 'visible');
      if (enProy) vizMostrar(ev, 'Proyección', [{ v: perNom(per(proy.fecha)), l: 'recupero estimado al ritmo actual' }, { v: fmtU(o.anual) + '/año', l: 'neto actual', c: 'var(--s1)', linea: true }]);
      else vizMostrar(ev, fDate(pts[best].fecha), [{ v: fmtU(pts[best].acum), l: 'neto acumulado', c: 'var(--s1)', linea: true }, { v: pct(pts[best].acum / o.meta * 100), l: 'de la inversión' }]);
    });
    hit.addEventListener('pointerleave', function(){ ch.setAttribute('visibility', 'hidden'); vizOcultar(); });
  });
}
