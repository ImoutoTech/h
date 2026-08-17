# Backend Quality Guidelines

The codebase is NestJS 10, TypeScript, Fastify, TypeORM, and pnpm. Match the existing decorator-based module architecture and run the repository's configured checks before handoff.

## Required Practices

- Keep controllers thin and services responsible for domain logic, persistence, caching, and sanitized return values.
- Define request DTOs under `src/dto/` and add runtime decorators for required, optional, enum, email, and string constraints. `CreateUserDto`, `OauthAuthorizeDto`, and `UpdateSubAppDto` are the main references.
- Register dependencies in the feature module and keep authorization decorators at route boundaries.
- Preserve cache consistency after mutations. User and application services use `user-<id>` and `app-<id>` keys.
- Use `import type` for type-only imports where the surrounding file already follows that convention.
- Use single quotes and trailing commas, as configured in `.prettierrc`.

## TypeScript Reality

`tsconfig.json` currently disables strict null checks and implicit-any enforcement, and ESLint permits explicit `any`. This is the current compatibility baseline, not encouragement to omit types. Prefer concrete DTOs, entity projections, `Repository<Entity>`, and shared payload types from `@reus-able/types`. Do not tighten global compiler flags as a side effect of unrelated work.

## CommonJS Runtime Import Boundary

The Nest production build emits CommonJS. `allowSyntheticDefaultImports` affects type-checking only; it does not create a runtime `.default` export. Before using a CommonJS dependency through a default import, inspect its actual Node export:

```bash
node -e "const value = require('package-name'); console.log(typeof value, typeof value.default)"
```

Packages that directly export a callable function (for example `sanitize-html`) must be normalized at their integration boundary when the test transformer and production CommonJS loader expose different shapes:

```typescript
// Wrong: compiles to require('sanitize-html').default, which is undefined.
import sanitizeHtml from 'sanitize-html';

// Correct: accept the callable CommonJS export and Vitest's namespace wrapper.
import * as sanitizeHtmlModule from 'sanitize-html';

const sanitizeHtml =
  typeof sanitizeHtmlModule === 'function'
    ? sanitizeHtmlModule
    : (sanitizeHtmlModule as { default: typeof sanitizeHtmlModule }).default;
```

Do not enable `esModuleInterop` globally as an incidental dependency fix. That changes emitted imports throughout the service. Keep compatibility normalization local to the dependency boundary.

### Runtime Validation Matrix

| Condition | Required result |
|---|---|
| Vitest imports the dependency through an ESM namespace wrapper | focused unit/security tests pass |
| Nest CommonJS build loads the direct callable export | compiled smoke test calls the real integration without `*.default is not a function` |
| Dependency import shape changes or is not callable | regression test fails before deployment |

Good: security behavior is tested in Vitest and the compiled CommonJS integration is invoked in a subprocess.

Base: a dependency with a verified native ESM/default export uses its documented import form.

Bad: unit tests pass under the test transform, but no test invokes the compiled production artifact for a module-shape-sensitive integration.

## Verification

For backend changes, run:

```bash
./node_modules/.bin/eslint "{src,apps,libs,test}/**/*.ts"
./node_modules/.bin/nest build
./node_modules/.bin/vitest run
```

The `lint` package script includes `--fix`, so use the non-mutating command above for review and use `pnpm run lint` only when formatting/fixes are intended. When a dependency's runtime module shape matters, add a regression that builds Nest and invokes the compiled boundary; a source-only Vitest import is insufficient. Some OIDC tests bind a localhost port and may require an environment that permits loopback listeners.

## Review Checklist

- Route inputs are validated and authorization metadata is correct.
- Ownership checks constrain the database query or happen before mutation.
- Entity relations needed by projections are loaded.
- Passwords, tokens, and full secrets never enter responses or logs.
- Database and Redis state remain consistent after create/update/delete.
- New providers and repositories are registered in their module.
- CommonJS dependency imports match the actual Node export shape, not only the test transform.
- Module-shape-sensitive integrations have a compiled production smoke assertion.
- Build and non-mutating lint pass.

Avoid business logic in controllers, returning raw entities with sensitive columns, hardcoding new secrets, silently swallowing exceptions, or documenting the generic Nest starter README as project behavior.
