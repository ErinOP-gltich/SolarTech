#!/bin/sh
# Put the website on Cloudflare Pages (project "solartech", served at https://greensuntechnologies.com/).
# Needs `npx wrangler login` once. Until the R2 bucket exists (see the admin project's README) this fails with
# "R2 bucket 'solartech-media' not found"; the site's own pages don't need it, only photo uploads from the console do.
set -e
tmp=$(mktemp -d)
rsync -a --exclude .git --exclude README.md --exclude brand-source --exclude deploy.sh --exclude node_modules --exclude .wrangler ./ "$tmp/"
cd "$tmp" && npx wrangler pages deploy . --project-name solartech --branch main --commit-dirty=true
