# Shared-module migration checklist (`netknife-common`)

Goal: move each Lambda off its hand-rolled `json()` / cache helpers onto the shared
`netknife-common` module (response + cache + SSRF helpers), so behavior is consistent
and boilerplate lives in one place.

## Status

Fully migrated (factory `createHandler` + `validation.js` + Layer + tests):
`dns`, `reverse-dns`, `headers`, `tls`, `rdap`, `traceroute`, `ip-api`, `asn-details`,
`greynoise`, `abuseipdb`, `virustotal`, `dns-propagation`.

Remaining (~32) still have an inline `json()` helper — see:

```bash
grep -rl "function json(\|const json =" backend/functions/*/index.js
```

## Why this is deploy-sensitive

`netknife-common` is delivered at runtime as a **Lambda Layer**
(`aws_lambda_layer_version.common`). A migrated function will `require('netknife-common')`,
which only resolves if **both** of these are true:

1. The function's Terraform block attaches `layers = [aws_lambda_layer_version.common.arn]`.
2. A copy of the module exists at `backend/functions/<fn>/node_modules/netknife-common`
   (used for local `node --test`; also bundled in the zip as a fallback).

Miss either and the Lambda throws `Cannot find module 'netknife-common'` at cold start.
Unit tests here **cannot** catch that — verify with a real deploy + a smoke request.

## Per-function steps

1. **`validation.js`** — extract pure logic (input parsing, cache-key builder, and a
   `validate*()` that returns either `null` or a `createResponse(...)`). Import
   `createResponse` from `netknife-common`.
2. **`index.js`** — convert to the factory pattern:
   ```js
   const { createResponse, createCacheClient } = require('netknife-common')
   function createHandler(deps = {}) {
     const fetchFn = deps.fetch || fetch
     const cache = deps.cache || createCacheClient({
       dynamodb: deps.dynamodb,
       cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
       payloadField: 'data', // use 'value' for dns/rdap-style records
     })
     return async function handler(event) { /* ... */ }
   }
   exports.createHandler = createHandler
   exports.handler = createHandler()
   ```
3. **Preserve response shape.** Match the original header casing with
   `createResponse(status, body, { headerStyle: 'title' })` when the old helper used
   `Content-Type`/`Cache-Control` title case. **Drop any hardcoded
   `Access-Control-Allow-Origin`** — CORS is owned by the API Gateway
   `cors_configuration` (and with `allow_credentials = true`, a Lambda-level `*` is
   actually incorrect).
4. **Local module copy:** `mkdir -p node_modules && cp -R ../../shared/netknife-common node_modules/netknife-common`
5. **Terraform:** add `layers = [aws_lambda_layer_version.common.arn]` to that function's
   `aws_lambda_function` block in `infra/modules/api/main.tf`.
6. **Test:** add `handler.test.js` that injects `{ cache, fetch }` and covers validation,
   cache-hit (no fetch), success+cache-put, and upstream-error paths. Run `node --test`.
7. **Verify:** `node --check index.js validation.js`, `terraform fmt`, and after deploy,
   hit the tool once and confirm a 200 + expected JSON.

## Known cleanup (do alongside)

- The copied `node_modules/netknife-common` can **drift** from `backend/shared/netknife-common`.
  Prefer a build step (or symlink) that syncs from the single source of truth, and
  exclude `*.test.js` from the copy to keep zips small.
