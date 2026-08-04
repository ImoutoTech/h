# OIDC Library Compatibility Gate

## Decision: STOP — Node 22 approval required

- Local runtime is Node `20.19.6`; NestJS 10/Fastify 4 build to CommonJS.
- Use an exact v9 release of `oidc-provider`. v9 is the currently supported major and is OpenID Certified. Its package is ESM (`type: module`) but declares no Node engine that forces Node 22.
- Use an exact v6 release of `openid-client` for Google. It is also ESM. GitHub uses the same standards-oriented primitives or a small provider adapter around `fetch`; no provider token persistence.
- Load ESM packages through a native dynamic-import bridge that TypeScript cannot downlevel to `require()`. Do not convert the whole Nest application to ESM.
- Runtime proof used `oidc-provider@9.8.2` and `openid-client@6.8.1` on Node `20.19.6`. CommonJS native dynamic import, Fastify mount, Discovery HTTP 200, and `pnpm run build` all succeeded.
- During initialization, `oidc-provider@9.8.2` explicitly reported: `Unsupported runtime. Use Node.js v22.x LTS, or a later LTS release.` Its runtime guard is in the installed package's `lib/index.js`.
- This triggers the pre-approved stop condition. Temporary proof dependencies were removed and package manifests/lockfile were restored; no backend implementation proceeded.
- Proceed only after explicit approval to move the service/deployment baseline to Node 22 LTS or after a materially different library strategy is reviewed. Do not select the older v8 major because it has reached its published security-support end date.

## Primary evidence

- `oidc-provider` v9 package metadata (`type: module`; no `engines`; current v9 dependency set):
  https://raw.githubusercontent.com/panva/node-oidc-provider/v9.8.2/package.json
- Project security policy lists v9 as supported and makes production adapter/key management the integrator's responsibility:
  https://raw.githubusercontent.com/panva/node-oidc-provider/main/SECURITY.md
- Project README states OpenID certification, Fastify mounting, Discovery/JWKS/PKCE support, and v9 support:
  https://github.com/panva/node-oidc-provider
- `openid-client` v6 package metadata (`type: module`):
  https://raw.githubusercontent.com/panva/openid-client/v6.8.1/package.json

## Adapter and testing implications

- The built-in in-memory adapter and development signing keys are development-only. Production requires a Redis adapter and explicit JWKS.
- Adapter tests must cover consume/replay, expiry, upsert/find/destroy, grant/session revocation, and key namespace isolation.
- The mount smoke test precedes schema/domain implementation so compatibility failure remains cheap to roll back.
