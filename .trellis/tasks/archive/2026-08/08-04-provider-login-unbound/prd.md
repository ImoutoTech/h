# 修复未绑定 Provider 登录自动建号

## Goal

外部 Provider 登录只认证已经明确绑定到本地用户的身份。未绑定的 Google/GitHub 身份不得隐式创建本地用户，应向前端返回可识别的“未绑定”结果，引导用户通过本地账号完成显式绑定，避免产生无法正常使用且占用外部身份的幽灵账号。

## Background

- 修复前，`ExternalIdentityService.resolve()` 在找不到 `(provider, provider_user_id)` 且 Provider 邮箱也没有本地用户时，会创建一个 `password = null` 的本地用户并立即绑定外部身份。
- 修复前，回调随后为该新用户签发会话；新用户没有 `roles` 关系，签发 Token 中的 `roles` 为空，用户报告该 Token 请求用户信息失败，前端最终回到首页且没有可操作提示。
- 修复前，隐式创建的 `external_identities` 记录会占用 `(provider, provider_user_id)` 唯一键；用户再用正常本地账号绑定同一 Google 身份时，会得到“外部身份已被其他账号绑定”。
- 前后端已经存在短期、单次消费的 `binding_required + bindingToken` 流程，但当前只在 Provider 的已验证邮箱与既有本地用户邮箱相同时触发。
- 已归档的 OAuth 登录中心需求曾允许首次外部登录自动建号；本任务以用户新确认的产品预期为准，修改该行为。

## Requirements

- R1：外部登录仅在 `(provider, provider_user_id)` 已绑定本地用户时签发本地会话。
- R2：外部身份未绑定时不得创建 `users` 或 `external_identities` 记录，也不得签发本地 Token。
- R3：未绑定结果必须是前后端均可识别的显式状态，不得附带 `bindingToken`；回调页仅提示“尚未绑定”，并引导用户先登录本地账号、再从登录方式设置重新发起 Provider 授权。
- R4：保留已绑定身份的再次登录、已登录用户从账号设置发起绑定、Provider 邮箱验证、一次性状态和唯一约束等现有安全边界。
- R5：并发回调或绑定竞争不得恢复隐式建号，也不得把已属于其他用户的外部身份转绑。
- R6：新增回归测试覆盖未绑定、已绑定和绑定冲突链路。

## Acceptance Criteria

- [x] 未绑定的 Google/GitHub 身份从登录入口回调后，数据库不新增用户和外部身份，响应不包含 Token。
- [x] 回调页面明确提示该 Provider 身份尚未绑定，不再表现为登录成功后静默跳转。
- [x] 未绑定结果不在浏览器或 Redis 中保留可续接绑定的凭证；点击下一步只进入本地登录，绑定必须从账号设置重新授权。
- [x] 已经绑定的 Provider 身份仍可正常登录并获得可读取当前用户信息的会话。
- [x] 正常登录的本地用户可绑定尚未归属其他用户的同一 Provider 身份。
- [x] 已归属其他本地用户的 Provider 身份继续拒绝绑定，且不会发生转绑或数据覆盖。
- [x] 自动化测试验证上述结果及数据库无副作用。

## Out of Scope

- 清理当前环境中已经错误创建的用户或外部身份数据；如需要，另行制定可审计的数据修复方案。
- 修改 Provider 配置、OIDC 协议服务、密码登录或注册规则。
- 增加 GitHub/Google 以外的新 Provider。

## Key Decision

- 用户选择不续接本次 Provider 授权：未绑定回调只展示提示，不生成 `bindingToken`。登录本地账号后，用户必须从账号设置重新发起 Provider 授权并完成绑定。
