# MySQL 5.7.44 升级与通知服务版本选择

## 结论

- 新通知服务不应在 2026 年新建 MySQL 8.0：MySQL 8.0 已于 2026-04 结束生命周期。
- 新通知服务若有独立数据库实例，优先直接使用 MySQL 8.4 LTS，并可使用 `SKIP LOCKED` 实现批量并发任务领取。
- 现有 MySQL 5.7.44 业务不能跳过 8.0 直接原地升级到 8.4。官方支持路径是 5.7 → 8.0 → 8.4。
- 现有业务统一升级不应成为通知服务首版的前置条件；应作为单独迁移项目执行 Upgrade Checker、预演、应用回归和回滚演练。

## 官方证据

- MySQL 8.0 Release Notes：8.0 于 2026-04 随 8.0.46 结束生命周期；升级应先在测试环境验证，且 8.0→5.7 不支持原地降级，只能恢复备份。
  - https://dev.mysql.com/doc/relnotes/mysql/8.0/en/
- MySQL 8.4 Upgrade Paths：5.7 不能跳过 8.0 直接升级到 8.4，必须先升级到 8.0，再升级到 8.4。
  - https://dev.mysql.com/doc/refman/8.4/en/upgrade-paths.html
- MySQL Shell Upgrade Checker：可以检查 5.7 实例面向目标版本的兼容错误、配置项删除和默认值变化。
  - https://dev.mysql.com/doc/mysql-shell/8.0/en/mysql-shell-utilities-upgrade.html
- MySQL 8.0 incompatibilities：需关注新保留字、移除的 SQL mode/功能、认证插件、字符集默认值和旧数据字典/表空间。
  - https://dev.mysql.com/doc/refman/8.0/en/upgrading-from-previous-series.html
- MySQL 8.4 LTS：LTS 面向稳定生产使用，官方说明其支持周期为 5 年 Premier + 3 年 Extended。
  - https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html

## 仓库静态检查

### `h`

- 使用 TypeORM 0.3.x 与 mysql2 3.x，驱动栈较新。
- 显式 migration 使用 JSON、`datetime(6)`、外键和 InnoDB，未发现明显 8.x 不兼容语法。
- 没有发现明显命中 MySQL 8 新保留字的表/列名。
- 仍需对真实 schema、账号认证插件、字符集/排序规则和运行查询做检查。

### `Applog`

- 使用 TypeORM 0.3.x 与 mysql2 3.x。
- 主要风险是生产配置中 `synchronize: true`；升级前应改为显式 migration，防止启动时产生不可审计 DDL。
- 存在 Typecho 迁移适配器和多段原生 SQL，需要使用真实导入数据回归。

### `note`

- 使用 Prisma 5.22，schema 使用 MySQL 常规类型；当前 Prisma 官方文档列出 MySQL 8.4 支持，但固定的 5.22 版本仍需实测或升级。
- 存在原生 SQL、`GET_LOCK`、`FOR UPDATE` 和 legacy dump 导入，需要集成测试。

### `paper-station`

- 使用 TypeORM 0.3.x 与 mysql2 3.x，`synchronize: false`。
- 静态扫描未发现明显不兼容 SQL；缺少完整迁移历史意味着真实 schema 仍需检查。

## 不能由源码证明的事项

- 生产实例中的实际表、索引、视图、触发器、存储过程、事件与分区。
- `sql_mode`、`lower_case_table_names`、字符集与排序规则。
- MySQL 用户使用的认证插件和客户端连接参数。
- 数据中的零日期、非法 ENUM/SET、旧 temporal 格式或其他 Upgrade Checker 才能发现的问题。
- 数据规模、停机窗口、备份恢复时长与性能回归。

## 现有业务迁移最低门槛

1. 对每个真实 5.7.44 实例运行 MySQL Shell Upgrade Checker，目标先设为计划采用的最新 8.0 过渡版本。
2. 保存并核对 schema、配置、账号插件、字符集/排序规则和保留字报告。
3. 从生产备份恢复到隔离测试实例，执行 5.7→8.0→8.4 完整预演。
4. 在 8.4 上运行各仓库的构建、集成测试和关键业务 smoke test。
5. 对 Applog 先关闭 `synchronize: true` 并建立显式 migration 基线。
6. 验证备份恢复；升级后不能把原数据目录直接降回 5.7。
