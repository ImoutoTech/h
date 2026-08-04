# 将 SSO 升级为 OAuth 登录中心

## Goal

把现有自定义 SSO 升级为可供子应用安全接入的标准登录中心，同时允许终端用户使用 GitHub、Google 等外部身份提供方登录，并允许管理员在管理面板维护提供方凭据和启停状态。

## Background / Confirmed Facts

- 当前后端为 NestJS 10 + Fastify + TypeORM 0.3 + MySQL，Redis 用于临时授权数据。
- `src/module/oauth` 当前实现自定义的授权码、访问令牌和用户信息接口，但不是完整的 OAuth 2.0 / OpenID Connect 实现：授权入口为已登录用户调用的 `POST /oauth/authorize`，缺少 PKCE、标准错误响应、scope/consent 等协议能力。
- `safe-house` 的授权页实际依赖该旧接口，并把响应中的 `access_token` 字段当作授权码拼入回调 URL；旧协议已有明确调用方。
- 当前 access token 仅存活 600 秒，并在调用一次 `/oauth/user` 后被删除。
- 子应用及其回调地址、client secret 已持久化在 `subapps`、`subapp_secrets` 等表中；回调地址当前使用字符串前缀匹配。
- 本仓库是后端服务；同一工作区的 `safe-house` 是 Vue 3 + Naive UI 前端，已有登录/注册、子应用管理和 `/oauth/authorize` 授权确认页面，可作为管理面板与 OIDC 交互页面的实现载体。
- `users.email` 唯一且非空，`users.password` 非空；目前只有邮箱密码注册/登录，没有外部身份关联表。
- 项目未引入 Passport、OIDC Provider 或第三方 OAuth 客户端库。

## Requirements

### R1 标准 OIDC 登录中心

- 实现 OpenID Connect，首期采用 OAuth 2.0 Authorization Code Flow + PKCE，让子应用通过标准 OIDC 客户端完成用户登录。
- 提供标准 Authorization、Token、UserInfo、Discovery (`/.well-known/openid-configuration`) 和 JWKS 能力。
- 签发可验证的 ID Token；校验 `state`、`nonce`、issuer、audience、授权码与客户端绑定关系。
- ID Token 使用部署环境注入的非对称私钥签名；私钥和 `kid` 不进入数据库或管理面板，JWKS 仅公开公钥。
- 支持部署时同时发布当前公钥和上一把公钥，使旧 Token 在其短期有效期内仍可验证；签名密钥轮换必须通过部署流程完成。
- 授权码必须短时、一次性使用；回调地址必须精确校验；首期所有客户端均必须使用 `S256` PKCE。
- 协议响应、错误和令牌生命周期应有明确且可测试的契约。
- 首期仅开放 `openid profile email` scope，签发短期 ID Token 与 Access Token。
- 首期不支持 `offline_access` 和 Refresh Token；子应用完成登录后自行建立会话，需要重新认证时再次发起 OIDC 授权。
- 每次授权均显示确认页，不持久化长期 consent。

### R2 外部身份提供方

- 首期接入 GitHub 和 Google。
- 支持外部身份首次登录创建或关联本地用户，后续稳定识别同一账号。
- 外部身份关联必须以提供方稳定用户 ID 为依据，不能只依赖可变邮箱。
- GitHub/Google 返回已验证邮箱且本地不存在该邮箱时，自动创建本地用户并绑定外部身份。
- 本地已存在相同邮箱时不得静默合并；用户必须先通过现有本地凭据登录，再主动绑定外部身份。
- 提供方无法返回已验证邮箱时不得自动注册；向用户返回可识别状态并引导其补充、验证邮箱后再完成绑定。
- 外部登录成功后的账号查找始终使用 `(provider, provider_user_id)`，邮箱仅用于首次建号或经认证的绑定流程。
- 保留现有邮箱密码注册和登录；已登录用户可在账号设置中绑定或解绑 GitHub、Google 身份。
- 解绑不得使用户失去所有可用登录方式；至少保留有效密码凭据或另一个外部身份。

### R3 管理配置

- 管理员可维护 GitHub、Google 的 client ID、client secret、回调地址相关配置和启停状态。
- secret 不得明文出现在日志或读取接口中；读取时仅返回掩码或“已配置”状态。
- 外部提供方 `client_secret` 在数据库中使用 AES-256-GCM 加密；主密钥仅由服务端环境变量注入。每条密文保存随机 nonce、认证标签和密钥版本，以支持完整性校验和后续轮换。
- 管理端更新 secret 时，空值表示保留原值；读取接口只能返回掩码及是否已配置，不能解密回显。
- 配置变更应有权限保护、输入校验和可审计日志。
- `h` 提供受管理员权限保护的配置 API；同工作区 `safe-house` 提供可视化管理页面，用于查看配置状态、更新凭据及启停 GitHub/Google。
- `safe-house` 同时增加 GitHub/Google 登录入口、外部身份绑定/解绑入口，并将现有授权确认页改造为标准 OIDC 交互页面。

### R4 兼容性与迁移

- `h` 与 `safe-house` 一次性协同升级到 OIDC，不为旧 `/oauth/authorize`、`/oauth/token`、`/oauth/user` 契约保留兼容层。
- 发布说明必须标识破坏性变更；已有其他子应用需要按标准 OIDC 客户端重新接入。
- 保留现有密码登录和注册，不强制已有用户迁移到外部身份。
- 建立 TypeORM DataSource、迁移命令及首个可回滚迁移；生产环境默认关闭 `synchronize`，本地开发只能通过显式环境变量选择自动同步。
- 迁移覆盖外部身份、提供方配置、OIDC 客户端数据和可空密码，并在切换前校验现有回调地址；存在歧义时必须阻止迁移而不是猜测。
- 部署按备份、迁移、同步发布 `h` 与 `safe-house`、端到端冒烟验证的顺序执行。
- 将后端运行时与部署基线升级为 Node 22 LTS，以使用处于安全支持期的 OIDC Provider；保留现有 CommonJS 编译方式，通过原生动态 import 加载 ESM 依赖。

## Acceptance Criteria

- [ ] 注册的子应用能通过标准授权码流程完成登录，授权码只能兑换一次，redirect URI 不完全匹配时拒绝请求。
- [ ] 所有客户端均使用 `S256` PKCE，缺失或错误的 code verifier 会被拒绝。
- [ ] ID Token 可通过 JWKS 验证，任何管理 API 均无法读取或修改 OIDC 签名私钥；轮换期间新旧有效 Token 都能按预期验证。
- [ ] Discovery 与授权端点只声明、接受首期支持的 `openid profile email`，不签发 Refresh Token，不支持的 scope 返回标准错误。
- [ ] 每次新的授权请求均进入授权确认流程，不因历史授权静默跳过 consent。
- [ ] 用户可通过已启用且配置有效的 GitHub 或 Google 登录，首次登录和再次登录结果符合最终账号关联策略。
- [ ] 同一外部账号不会重复创建本地用户，提供方身份以 `(provider, provider_user_id)` 唯一标识。
- [ ] 已存在邮箱不会因外部提供方返回同名邮箱而被静默绑定；只有已认证的本地用户可主动完成绑定。
- [ ] 缺少已验证邮箱的外部身份不会创建不完整或重复用户。
- [ ] 原有用户仍可使用邮箱密码注册和登录，并可在认证后绑定或解绑 GitHub、Google；系统阻止解绑最后一种可用登录方式。
- [ ] 管理员能查看提供方配置状态、更新凭据并启停提供方；非管理员不能操作。
- [ ] `safe-house` 中管理员可完成提供方配置操作，普通用户可使用外部登录并管理自己的身份绑定，OIDC 授权页可正确保留和提交标准请求参数。
- [ ] 管理读取接口和日志均不泄露完整 client secret、授权码、访问令牌或刷新令牌。
- [ ] 数据库泄露时无法在缺少环境主密钥的情况下直接恢复第三方 client secret；篡改密文会被认证校验发现。
- [ ] 提供方被禁用或配置无效时，登录请求返回可识别且不泄密的错误。
- [ ] 自动化测试覆盖协议安全边界、外部账号关联、配置权限和 secret 脱敏。
- [ ] TypeORM migration 可在隔离数据库中完成升级与回滚，原有用户和合法子应用数据得到保留；生产配置不会在服务启动时隐式同步结构。
- [ ] GitHub/Google 临时访问令牌不会持久化，外部回调的 state 被篡改、重放或过期时均被拒绝。
- [ ] 发布文档明确环境变量、提供方回调地址、密钥生成/轮换、迁移步骤、破坏性接口移除及回滚限制。
- [ ] 本地、CI 和生产构建/启动均使用 Node 22 LTS；启动时不再出现 OIDC Provider 的 unsupported runtime 警告，且无需全项目 ESM 转换。

## Out of Scope

- SAML、LDAP、企业目录同步。
- GitHub 和 Google 之外的提供方（架构应允许后续扩展）。
- MFA、无密码登录、设备授权流，除非后续明确纳入。
- OIDC 动态客户端注册、Implicit/Hybrid Flow、OIDC conformance certification。
