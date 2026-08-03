# Logging Guidelines

Application services use `HLogger` from `@reus-able/nestjs`, provided by `LoggerModule` in `src/app.module.ts`.

## Service Pattern

Inject the logger with `@Inject(HLOGGER_TOKEN)` and wrap it so every record carries the service name:

```ts
private log(text: string) {
  this.logger.log(text, UserService.name);
}

private warn(text: string) {
  this.logger.warn(text, UserService.name);
}
```

This pattern is repeated in `UserService`, `SubAppService`, `OAuthService`, `SystemService`, and `AuthPermissionService`.

## Levels and Events

- Use `log` for successful domain actions, lifecycle steps, and useful query summaries: login success, initialization progress, mutation completion, and paginated result counts.
- Use `warn` for rejected or suspicious expected actions: missing resources, bad passwords, invalid OAuth callbacks/codes, and ownership violations.
- Allow unexpected exceptions to flow to the global exception filters. There is no local `error` wrapper pattern in the current codebase.
- Include stable identifiers and relevant non-secret parameters. Existing messages use forms such as `用户#${id}` and `子应用#${id}` and are written in Chinese.

## Sensitive Data

Never log passwords, password hashes, JWTs, OAuth authorization codes, access tokens, Redis payloads, database credentials, or complete application secrets. Although older secret-management messages in `src/module/subapp/subapp.service.ts` include `secret.value`, do not copy that pattern into new work; log the secret id or application id instead.

Avoid logging entire request bodies or raw entity objects. When logging a user projection, confirm that the projection excludes credentials, as `User.getData()` does.
