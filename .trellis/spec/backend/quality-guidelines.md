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

## Verification

For backend changes, run:

```bash
pnpm exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm run build
```

The `lint` package script includes `--fix`, so use the non-mutating command above for review and use `pnpm run lint` only when formatting/fixes are intended. The repository currently has no test files and defines no test script despite the starter README mentioning tests. Do not claim test coverage; add an explicit test setup when a feature requires automated tests.

## Review Checklist

- Route inputs are validated and authorization metadata is correct.
- Ownership checks constrain the database query or happen before mutation.
- Entity relations needed by projections are loaded.
- Passwords, tokens, and full secrets never enter responses or logs.
- Database and Redis state remain consistent after create/update/delete.
- New providers and repositories are registered in their module.
- Build and non-mutating lint pass.

Avoid business logic in controllers, returning raw entities with sensitive columns, hardcoding new secrets, silently swallowing exceptions, or documenting the generic Nest starter README as project behavior.
