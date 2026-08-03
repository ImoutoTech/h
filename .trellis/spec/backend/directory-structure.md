# Backend Directory Structure

This repository is a single NestJS application. Runtime code lives under `src/`; there are no separate frontend or shared-library packages.

## Layout

```text
src/
├── main.ts                 # Fastify bootstrap and global filters/interceptors
├── app.module.ts           # root configuration and global providers
├── module/<feature>/       # Nest feature modules
│   ├── <feature>.module.ts
│   ├── <feature>.controller.ts
│   └── <feature>.service.ts
├── dto/<feature>/          # request DTOs and feature barrel exports
├── entity/                 # TypeORM entities and response projection types
└── utils/                  # application-wide constants and small pure helpers
```

## Feature Modules

- Put HTTP routing and Nest parameter decorators in controllers; delegate application and persistence work to the matching service. See `src/module/user/user.controller.ts` and `src/module/user/user.service.ts`.
- Register each feature's controllers, services, configuration, and TypeORM repositories in its module. See `src/module/oauth/oauth.module.ts` and `src/module/system/system.module.ts`.
- Keep a feature in `src/module/<feature>/` with lowercase directory names and dot-suffixed files such as `subapp.service.ts`.
- Add entities to `TypeOrmModule.forFeature(...)` in every module that injects their repositories. Root `autoLoadEntities` is configured in `src/app.module.ts`.

## Shared Types and Imports

- Request types belong in `src/dto/<feature>/`; export them through the feature `index.ts` and then `src/dto/index.ts`.
- Persistent models belong in `src/entity/` and are re-exported by `src/entity/index.ts`.
- Use the `@/*` alias for cross-feature imports (`@/dto`, `@/entity`, `@/utils`). Use relative imports within one feature directory.
- Keep small, truly cross-cutting helpers in `src/utils/`; `generateRandomString` in `src/utils/index.ts` is the current example.

## Boundaries to Preserve

- Do not put repository queries or cache writes in controllers.
- Do not add a new top-level package for a feature that fits the existing Nest module structure.
- Do not return raw user or application entities when they contain secrets. Use entity projections such as `User.getData()` and `SubApp.getData()`.

Representative modules: `src/module/user/`, `src/module/subapp/`, and `src/module/oauth/`.
