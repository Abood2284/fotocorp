#!/usr/bin/env bash
set -euo pipefail

urls=(
  "http://127.0.0.1:8787/api/v1/public/events/latest?windowDays=30&limit=15"
  "http://localhost:3000/api/public/events/latest?windowDays=30&limit=15"
  "http://localhost:3000/"
)

for url in "${urls[@]}"; do
  echo "=== ${url} ==="
  for i in 1 2 3 4 5; do
    curl -sS -o /dev/null \
      -w "run=${i} status=%{http_code} dns=%{time_namelookup}s connect=%{time_connect}s ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}\n" \
      "$url" || echo "run=${i} status=curl_error"
  done
  echo
done
