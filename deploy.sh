#!/bin/sh
# Put the website on Cloudflare Pages (project "solartech", https://greensuntechnologies.com/). Needs `npx wrangler login` once.
#   ./deploy.sh            production
#   ./deploy.sh preview    a preview copy at https://preview.solartech-5bq.pages.dev (production untouched)
#   ./deploy.sh build      only build the upload copy in a temp folder (try it with npx wrangler pages dev <folder>)
# The upload is a trimmed copy: no README or logo sources, CSS and JS minified, CSS lengths scaled for the 90% default
# size (scale.mjs), every ?v= link stamped with this deploy;
# seo.mjs first refreshes the catalogue's structured data in products.html and the sitemap.
# Until the R2 bucket exists (see the admin project's README) the photo binding and /media are left out.
set -e
branch=main; [ "$1" = "preview" ] && branch=preview
node seo.mjs   # catalogue structured data + sitemap follow products.js
src=$(pwd)
tmp=$(mktemp -d)
rsync -a --exclude .git --exclude README.md --exclude deploy.sh --exclude seo.mjs --exclude scale.mjs --exclude test --exclude node_modules --exclude .wrangler --exclude .gitignore ./ "$tmp/"
cd "$tmp"
npx --yes esbuild@0.25 assets/js/*.js assets/css/*.css --minify --legal-comments=none --log-level=warning --outbase=. --outdir=. --allow-overwrite
node "$src/scale.mjs" assets/css/*.css
v=$(date +%s); for f in *.html; do sed -i '' "s/?v=[0-9A-Za-z]*/?v=$v/g" "$f"; done
if ! npx wrangler r2 bucket list 2>/dev/null | grep -q "solartech-media"; then
  python3 - <<'PY'
import re
s = open('wrangler.jsonc').read(); s = re.sub(r',\s*"r2_buckets": \[.*?\]', '', s, flags=re.S); open('wrangler.jsonc', 'w').write(s)
open('_routes.json', 'w').write('{ "version": 1, "include": ["/api/*"], "exclude": [] }\n')
PY
  rm -rf functions/media
  echo "(R2 not set up yet: deploying without the photo bucket)"
fi
[ "$1" = "build" ] && { echo "built in $tmp (not deployed)"; exit 0; }
npx wrangler pages deploy . --project-name solartech --branch "$branch" --commit-dirty=true
