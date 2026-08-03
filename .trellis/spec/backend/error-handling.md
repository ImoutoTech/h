# Error Handling

Client-visible domain failures use `BusinessException` from `@reus-able/nestjs`. Global normalization is installed in `src/main.ts` through `AllExceptionsFilter`, `HttpExceptionFilter`, and `TransformInterceptor`.

## Boundary Validation

- Validate request bodies with `class-validator` decorators on DTOs. The global `ValidationPipe` in `src/app.module.ts` transforms inputs and converts validation failures to `BusinessException`.
- Use Nest pipes for scalar route/query values. Pagination endpoints demonstrate `DefaultValuePipe` plus `ParseIntPipe`; OAuth token parameters demonstrate `RequiredPipe`.
- Put authorization metadata on controller methods with `@AuthRoles(...)` or `@PermissionGuard(...)`. Resource ownership still belongs in the service because it requires persisted data.

## Service Failures

- Log an actionable warning and throw a Chinese client-facing `BusinessException` for expected domain failures. See missing users in `UserService.findOne`, invalid callbacks in `OAuthService.authorize`, and missing applications in `SubAppService.findOne`.
- `BusinessException.throwForbidden()` is the established response for ownership violations in `SubAppService.getOneUserApp`.
- Use `isNil` when the repository can return `null` or `undefined`; do not rely on truthiness for domain objects.
- Let unexpected infrastructure exceptions reach the global filters unless the service can translate them into a meaningful domain error. `UserService.create` translates repository save errors, but new code should not expose raw SQL, credentials, or stack details in the message.

## Response Safety

- Return sanitized projections (`User.getData()`, `SubApp.getData()`) rather than entities containing passwords or full secrets.
- Secret-list responses mask stored secret values in `SubAppService.getAppSecret`.
- Do not catch an error merely to return `null` or `false`; successful empty returns are used only for commands such as secret toggling/deletion.

## Async Correctness

Await writes that must complete before success is returned. If an intentionally detached write is introduced, document why failure can be ignored; the default is to await it.
