# OIDC 机器认证调研

## 当前代码事实

- `h` 固定把子应用配置为 `authorization_code`，Discovery 也只声明该授权类型。
- `OAuthService.findAccount()` 当前把所有用户的 `email_verified` 硬编码为 `true`。
- 子应用已区分 `public` / `confidential`，confidential 应用已有可轮换、加密保存的 client secret。
- 当前依赖版本为 `oidc-provider@9.8.2`，实现必须针对该固定版本做集成测试，不能只依据最新版文档推断。

## 官方能力依据

- `oidc-provider` 的 `features.clientCredentials.enabled` 可启用 Client Credentials grant。
- Resource Indicators 可通过 `getResourceServerInfo` 为资源定义 audience、允许 scope、token TTL 与 JWT access token 格式。
- Client Credentials 请求只能指定一个 resource，适合让业务系统取得仅面向通知 API 的机器令牌。
- `extraTokenClaims` 可向 JWT access token 增加必要的顶层 claim；标准 `client_id` 应作为调用应用身份，避免再定义含义重复的自有 claim。

官方资料：

- https://github.com/panva/node-oidc-provider
- https://raw.githubusercontent.com/panva/node-oidc-provider/v9.8.2/docs/README.md

## 设计结论

- H 新增两个资源 audience：通知 API、H 内部联系信息 API；通知管理 API 使用独立 audience。
- 业务子应用通过 Client Credentials 获取通知 API token；通知服务以自己的 confidential client 获取 H Contact API token。
- H 必须按子应用持久化允许的 resource/scope 白名单。客户端传入的 scope/resource 只能取白名单交集，不能自行扩大权限。
- 通知服务离线校验签名、issuer、audience、expiry、client_id 和 scope；不在每次业务调用时做 token introspection。
- 管理员仍走 Authorization Code + PKCE，管理员权限由 H 角色/权限映射成通知管理 scope。
- 实施前用真实 `oidc-provider@9.8.2` 建立集成测试，覆盖 token 申请、错误 scope/resource、JWKS 轮换及 Discovery。

## 风险

- 当前 Provider 配置与客户端指纹只包含授权码相关字段；增加资源授权表后，指纹必须包含授权变化，否则运行中的 Provider 可能不刷新。
- 当前 Client Credentials 尚未启用，不能把“文档支持”视为“现有集成可直接工作”。
- `email_verified` 的历史硬编码需要和邮箱状态迁移一起修正，否则 Contact API 与 OIDC claim 会产生两个事实来源。
