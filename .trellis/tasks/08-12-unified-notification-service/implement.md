# H 内置轻量化消息通知服务实施计划

## Dependency order

1. 冻结 H DTO/projection/error contracts 与 schema migration。
2. 实现 H domain/application flow，再实现 adapters/dispatcher 与 admin/owner controllers。
3. Safe House 按稳定 H contracts 实现。
4. 进行跨仓 security、recovery 与 UX 验收。

Safe House 可用 typed fixtures 独立验证，但集成完成依赖 H 管理与 Owner-Key interfaces。Dispatcher 验证依赖持久层、加密、配置和 SMTP adapter。

## H backend

- [ ] 加入 SMTP client、HTML sanitizer 等兼容依赖并锁定版本。
- [ ] 添加 channel/template/policy/grant/key/notification/delivery entities、exports 与可逆 migration；验证 metadata load 与 up/down preflight。
- [ ] 添加 notification-purpose envelope 与 key-version resolver，测试 AAD 隔离、篡改、hint 和轮换。
- [ ] 实现 SMTP projection/update，含 password 留空不修改与独立 permission。
- [ ] 实现模板 parser、variable contract、HTML sanitizer、CRUD/enable 和独立 permission。
- [ ] 实现 app policy/grants，确保仅管理员可扩大能力。
- [ ] 实现 owner-scoped Notification Key create/list/toggle/delete 与恒定时间 guard validation。
- [ ] 实现 recipient resolve/dedupe、controlled hybrid DTO、content snapshot、optional idempotency 和 Redis limits。
- [ ] 原子保存 notification 与最多 20 个 deliveries；实现 ownership-safe status projection。
- [ ] 实现 `ChannelAdapter` registry、SMTP adapter 与 deterministic test adapter。
- [ ] 实现 lease dispatcher、retry classification/backoff、root aggregation 与 expired-lease recovery。
- [ ] 实现 24h payload purge、7d cleanup 和 key-version safety。
- [ ] 添加不泄露 secret/content 的结构化日志和审计记录。

## Safe House

- [ ] 添加 notification transport/domain types 与 endpoint factories。
- [ ] 添加 administrator data/actions 与 owner Key lifecycle composables。
- [ ] 保持 `user-manage.vue` 为 composition surface；添加 SMTP form、template list/form、app-policy modules。
- [ ] 扩展现有 subapp detail/secret 区，加入 Notification Key 管理和一次性明文显示。
- [ ] 加入 route/action permissions、loading/error/empty states、field validation 与 768px responsive behavior。
- [ ] Password/Key plaintext 不进入 Pinia/localStorage，使用后清除。
- [ ] 不用不可信 `v-html` 渲染模板，首期仅源码编辑。

## Verification

### H

```sh
pnpm exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm run build
pnpm test
pnpm migration:check-load
pnpm migration:show
```

在 disposable MySQL 5.7-compatible database 上跑 up/down/up。自动化使用 test adapter，另用 sandbox SMTP 做一次 multipart smoke test。

### Safe House

```sh
pnpm type-check
pnpm lint
pnpm build
```

额外验证管理员/非管理员可见性、password 留空不修改、template validation、policy editing、一次性 Key 显示，以及桌面/移动宽度。

## Required scenarios

- Key plaintext once-only、digest validation、错误/禁用/删除 Key、ownership isolation、policy tightening 即时生效。
- SMTP config encryption/tamper、password 不返回/不记录、留空更新、disabled/incomplete behavior。
- Template key uniqueness/immutability、缺失/多余变量、escaping/sanitization、direct-content capability、multipart alternative。
- 混合 user/manual、invalid-target atomic rejection、dedupe、20-recipient limit、address isolation。
- Optional idempotency 同/异请求、无 key duplicates、retention 后窗口结束。
- Transaction rollback 不留 root/child；Redis outage 对外 fail closed。
- Parallel dispatcher claim once、expired lease recovery、transient/permanent classification、partial failure、H restart recovery。
- 24h purge、7d delete，logs/projections 不含地址、内容和凭据。

## Risk and rollback guards

- 仍有活动 ciphertext 引用时不得移除 encryption key version。
- MySQL DDL 可能隐式 commit；migration 在破坏性操作前验证 rollback safety。
- Schema、key 与 SMTP 未就绪时不启动 dispatcher；startup validation 明确失败或保持关闭。
- 两个仓库均保留用户无关改动；Safe House 独立验证与暂存。
- Rollback 先停 acceptance/dispatch，再 drain 或明确 purge，最后才 schema revert。

## Before `task.py start`

- [ ] 用户批准最新 final planning summary。
- [ ] `prd.md`、`design.md` 与本计划一致。
- [ ] `implement.jsonl`、`check.jsonl` 含真实 H/Safe House spec context。
- [ ] 检查两个 worktree status 并保留无关改动。
