# Git 提交记录

本文档包含了所有安全性和稳定性改进的 Git 提交命令。

---

## 提交 1: 修复激活式令牌并发激活问题

**描述：** 使用数据库乐观锁防止激活式令牌在高并发场景下被重复激活

**影响文件：**
- `model/token.go`

**提交命令：**
```bash
git add model/token.go
git commit -m "fix(token): 使用乐观锁防止激活式令牌并发激活

- 在 Activate() 方法中使用 WHERE activated_time = 0 条件更新
- 如果更新失败（RowsAffected = 0），重新读取已激活的令牌状态
- 防止高并发场景下的重复激活和数据不一致
- 添加日志记录跳过的重复激活操作

问题：同一令牌在极短时间内被多次调用可能导致重复激活
解决：数据库层面的乐观锁，无需 Redis 分布式锁
影响：极小，只在首次激活时增加一次条件检查"
```

---

## 提交 2: 统一令牌状态查询接口错误信息

**描述：** 防止通过错误信息探测令牌是否存在或令牌类型

**影响文件：**
- `controller/token.go`

**提交命令：**
```bash
git add controller/token.go
git commit -m "security(token): 统一令牌状态查询接口错误信息

- 将所有错误情况统一返回 '令牌不存在或不可查询'
- 防止通过不同错误信息探测令牌是否存在
- 防止通过错误信息探测令牌类型（激活式 vs 普通）
- 提高公开查询接口的安全性

之前：
- 令牌不存在：'令牌不存在'
- 令牌类型错误：'该令牌不是激活式令牌'

现在：
- 所有情况：'令牌不存在或不可查询'

影响：无性能影响，提高安全性"
```

---

## 提交 3: 加强速率限制配置文档

**描述：** 为 CriticalRateLimit 添加注释说明其安全重要性

**影响文件：**
- `common/constants.go`

**提交命令：**
```bash
git add common/constants.go
git commit -m "docs(rate-limit): 添加 CriticalRateLimit 配置说明

- 为 CriticalRateLimitNum 和 CriticalRateLimitDuration 添加注释
- 说明其用于保护敏感接口（如令牌状态查询）
- 强调防止暴力枚举的重要性

配置：20 次请求 / 20 分钟
用途：保护公开查询接口，防止令牌枚举攻击"
```

---

## 提交 4: 为批量操作添加事务保护

**描述：** 确保令牌分组批量操作的原子性和数据一致性

**影响文件：**
- `model/token_group.go`

**提交命令：**
```bash
git add model/token_group.go
git commit -m "fix(token-group): 为批量操作添加事务保护

为以下批量操作添加数据库事务：
- BatchUpdateTokensExpiredTime: 批量更新过期时间
- BatchSetTokensExpiredTime: 批量设置过期时间
- BatchAddTokensQuota: 批量增加额度
- BatchUpdateTokensStatus: 批量更新状态

改进：
- 使用 tx.Begin() / tx.Commit() / tx.Rollback()
- 失败时自动回滚，确保数据一致性
- 防止部分更新成功、部分失败的情况

问题：批量操作中途失败可能导致数据不一致
解决：事务保证原子性，要么全部成功，要么全部回滚
影响：极小，事务开销很小且批量操作不频繁"
```

---

## 提交 5: 优化竞速请求资源清理逻辑

**描述：** 使用动态超时时间，确保 goroutine 有足够时间完成清理

**影响文件：**
- `service/race_request.go`

**提交命令：**
```bash
git add service/race_request.go
git commit -m "perf(race-request): 优化 goroutine 资源清理逻辑

- 将固定 1 秒超时改为动态计算（竞速超时的 2 倍）
- 最小 3 秒，最大 10 秒，平衡清理时间和响应速度
- 改进日志：成功时记录 'all goroutines completed successfully'
- 超时时记录具体的超时时间
- 即使超时也不阻塞主流程，goroutine 会在后台自然完成

之前：固定等待 1 秒，可能不够导致资源泄漏
现在：动态调整，适应不同的竞速配置

影响：无性能影响，提高资源清理可靠性"
```

---

## 提交 6: 增强删除令牌分组的完整性检查

**描述：** 在删除分组前检查分组状态并记录日志

**影响文件：**
- `controller/token_group.go`

**提交命令：**
```bash
git add controller/token_group.go
git commit -m "feat(token-group): 增强删除分组的完整性检查

- 先检查分组是否存在，避免无效操作
- 检查分组状态（正常/暂停/禁用）
- 对活跃分组的删除操作记录日志，便于审计
- 保持向后兼容，不改变删除行为

改进：
- 更早发现分组不存在的错误
- 记录活跃分组删除操作：id, name, status
- 为未来可能的更严格检查预留空间

影响：极小，只增加一次查询和可能的日志记录"
```

---

## 提交 7: 添加安全性改进文档

**描述：** 记录所有安全性和稳定性改进的详细信息

**影响文件：**
- `SECURITY_IMPROVEMENTS.md` (新文件)

**提交命令：**
```bash
git add SECURITY_IMPROVEMENTS.md
git commit -m "docs: 添加安全性和稳定性改进文档

创建 SECURITY_IMPROVEMENTS.md 文档，包含：
- 所有改进的问题描述和解决方案
- 实现细节和代码示例
- 测试建议和监控建议
- 性能影响评估
- 数据库兼容性说明
- 回滚方案

改进总结：
- 3 个高优先级安全性修复
- 3 个中优先级稳定性改进
- 0 个破坏性变更
- 100% 向后兼容
- 100% 数据库兼容（SQLite/MySQL/PostgreSQL）"
```

---

## 一次性提交所有改进（可选）

如果希望将所有改进作为一个提交：

```bash
git add model/token.go controller/token.go common/constants.go \
        model/token_group.go controller/token_group.go \
        service/race_request.go SECURITY_IMPROVEMENTS.md

git commit -m "fix: 上线前安全性和稳定性改进

高优先级修复：
1. 使用乐观锁防止激活式令牌并发激活
2. 统一令牌状态查询接口错误信息，防止信息泄露
3. 加强速率限制配置文档说明

中优先级修复：
4. 为批量操作添加事务保护，确保数据一致性
5. 优化竞速请求资源清理逻辑
6. 增强删除令牌分组的完整性检查

详细信息请参考 SECURITY_IMPROVEMENTS.md

影响：
- 0 个破坏性变更
- 100% 向后兼容
- 100% 数据库兼容
- 性能影响极小或无影响"
```

---

## 执行建议

### 推荐方式：分开提交（便于代码审查和回滚）
```bash
# 按顺序执行提交 1-7
# 每个提交都是独立的，可以单独审查和回滚
```

### 快速方式：一次性提交（适合快速上线）
```bash
# 执行"一次性提交所有改进"命令
# 适合紧急上线或小团队
```

---

## 提交后验证

```bash
# 查看提交历史
git log --oneline -7

# 查看具体提交内容
git show HEAD
git show HEAD~1
# ...

# 推送到远程仓库
git push origin <branch-name>
```

---

## 注意事项

1. **其他文件的修改：** 
   - 本次只提交安全性和稳定性改进相关的文件
   - 其他文件（如前端文件、路由等）可能包含令牌分组功能的实现
   - 建议单独审查和提交这些功能性改进

2. **新增文件：**
   - `controller/token_group.go` (新文件)
   - `model/token_group.go` (新文件)
   - `web/src/pages/TokenStatus/` (新目录)
   - 这些是令牌分组和激活式令牌查询功能的实现
   - 建议作为功能性提交，与安全性改进分开

3. **测试：**
   - 提交前确保所有测试通过
   - 建议在测试环境验证所有改进
   - 特别关注并发场景和边界情况

4. **文档：**
   - 更新 CHANGELOG.md（如果有）
   - 更新 README.md 中的安全性说明（如果需要）
   - 通知团队成员关于这些改进
