#!/usr/bin/env bash
# Arma index.html (archivo único que se publica) a partir de src/.
# Uso: bash build.sh   — después subir index.html, version.json, sw.js, manifest.json e íconos.
set -e
cd "$(dirname "$0")"
cat src/00-head.html src/10-core.js src/12-auth.js src/20-calc.js src/25-charts.js src/30-ui.js src/40-inmuebles.js src/50-contratos.js src/60-pagos.js src/65-recibos.js src/70-gastos-liq.js src/75-liquidacion.js src/80-avisos-docs.js src/90-ajustes-init.js src/92-usuarios.js src/94-import-contratos.js src/99-foot.html > index.html
v=$(grep -o "APP_VERSION = '[^']*'" src/10-core.js | cut -d"'" -f2)
printf '{"v":"%s"}\n' "$v" > version.json
echo "index.html $(wc -c < index.html) bytes — versión $v"
