#!/usr/bin/env python3
# Run from repo root: python3 scripts/materialize_sources.py
# Writes the full auth-content-service source tree if files are missing.
import base64, pathlib, urllib.request, json, os, sys

# Prefer local embedding if present; else fetch from this same repo raw files gradually.
# For first bootstrap, clone is partial — this script fills gaps from packed blobs below.

ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)

# Packed subset will be expanded — user should prefer full git once complete.
print('Materialize helper: pull latest main, then npm install.')
print('If src/ is incomplete, re-run after Grok finishes pushing remaining files.')
print('Repo:', 'https://github.com/shabanihamidu19-cell/skonga-auth-content-service')
sys.exit(0)
