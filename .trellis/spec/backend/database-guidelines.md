# Database Guidelines

The application uses TypeORM 0.3 with MySQL. Connection configuration is built from `ConfigService` in `src/app.module.ts`; entities are discovered through `autoLoadEntities`.

## Entities and Naming

- Define persistence models with TypeORM decorators in `src/entity/` and export them from `src/entity/index.ts`.
- Existing table naming is explicit for domain tables (`users`, `subapps`, `subapp_meta`, `subapp_secrets`) and implicit for `Role` and `Permission`. Preserve the mapped name of an existing table; choose an explicit stable name for new tables.
- Primary keys are generated integers unless the domain requires otherwise. `SubApp` demonstrates the UUID exception with `@Generated('uuid')` and `@PrimaryColumn()`.
- Use decorator-managed timestamps. Existing entities use either `created_at`/`updated_at` (`User`, `SubApp`) or `createTime`/`updateTime` (`Role`, `Permission`); match the entity being extended rather than silently renaming persisted columns.
- Declare relation loading explicitly in queries. Examples include object-shaped relations in `SubAppService` and `relations: ['roles']` in `UserService`.

## Repository Patterns

- Inject `Repository<Entity>` with `@InjectRepository(Entity)` in services, and register the entity with `TypeOrmModule.forFeature(...)` in the owning module.
- Use `findOneBy` for a simple key lookup, `findOne` for relations or richer predicates, and `findOneOrFail` only where TypeORM's not-found failure is intentionally handled by the global filters. The dominant examples are in `src/module/user/user.service.ts` and `src/module/oauth/oauth.service.ts`.
- Use `nestjs-typeorm-paginate` for list endpoints and return `{ items, count, total }`, as in `UserService.findAll` and `SubAppService.findAll`.
- Load every relation required by a projection before calling `getData()`. `SubApp.getData()` reads `owner` and `meta`, so list/detail queries request both.
- Await persistence and cache operations when subsequent behavior depends on them. After a mutation, update or delete the corresponding Redis entry (`user-<id>`, `app-<id>`).

## Relations and Deletes

- Configure ownership on the entity and query through nested relation predicates when authorizing child resources. `SubAppService.setAppSecret` and `delAppSecret` constrain both application owner and secret id.
- Existing relation tables have explicit names: `user_role_relation` and `role_permission_relation`.
- Cascading application metadata/secrets is modeled on `SubApp`, `SubAppMeta`, and `SubAppSecret`; inspect both sides before changing cascade or delete behavior.

## Schema Changes

There is currently no migrations directory or migration command. `synchronize: true` in `src/app.module.ts` updates the schema at runtime. Do not invent a migration workflow in a feature change. Any production-oriented change away from synchronization must be handled as an explicit infrastructure task with rollout and rollback planning.

Avoid raw SQL and unscoped bulk writes when repository APIs express the operation. Also avoid assuming TypeORM automatically loads relations.
