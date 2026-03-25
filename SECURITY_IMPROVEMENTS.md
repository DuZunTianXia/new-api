# 安全性和稳定性改进文档

本文档记录了在项目上线前实施的所有安全性和稳定性改进。

## 改进日期
2025年（上线前）

## 改进概述

本次改进主要针对以下四个关键功能进行了安全性和稳定性增强：
1. 激活式令牌
2. 令牌分组
3. 竞速请求
4. 用户查询 API Key 状态

---

## 高优先级修复

### 1. 激活式令牌并发激活问题

**问题描述：**
在高并发场景下，同一激活式令牌可能被多次同时调用，导致重复激活，可能造成激活时间和过期时间不一致。

**解决方案：**
使用数据库乐观锁机制，确保令牌只能被激活一次。

**修改文件：** `model/token.go`

**实现细节：**
```go
// 使用乐观锁：只有当 activated_time 仍为 0 时才更新
result := DB.Model(&Token{}).
    Where("id = ? AND activated_time = 0", token.Id).
    Updates(map[string]interface{}{
        "activated_time": newActivatedTime,
        "expired_time":   newExpiredTime,
    })

// 如果没有行被更新，说明令牌已经被激活了
if result.RowsAffected == 0 {
    // 重新读取令牌以获取最新的激活时间
    // ...
}
```

**优势：**
- 无需 Redis 分布式锁，降低系统复杂度
- 兼容所有三种数据库（SQLite, MySQL, PostgreSQL）
- 性能开销小，只增加一次条件检查
- 自动处理并发冲突，后续请求会获取已激活的状态

---

### 2. 令牌状态查询接口错误信息统一

**问题描述：**
公开查询接口对于不存在的令牌和非激活式令牌返回不同的错误信息，可能被用于探测令牌是否存在。

**解决方案：**
统一所有错误情况的返回信息，避免信息泄露。

**修改文件：** `controller/token.go`

**实现细节：**
```go
// 之前：
// - "令牌不存在" (令牌不存在时)
// - "该令牌不是激活式令牌" (令牌存在但类型不对时)

// 现在：统一返回
"令牌不存在或不可查询"
```

**优势：**
- 防止通过错误信息探测令牌是否存在
- 防止通过错误信息探测令牌类型
- 提高系统安全性，符合安全最佳实践

---

### 3. 速率限制配置加强

**问题描述：**
公开查询接口需要严格的速率限制，防止暴力枚举令牌。

**解决方案：**
确认并文档化现有的 CriticalRateLimit 配置。

**修改文件：** `common/constants.go`

**配置说明：**
```go
CriticalRateLimitNum      = 20        // 默认 20 次请求
CriticalRateLimitDuration = 20 * 60   // 默认 20 分钟
```

**环境变量：**
- `CRITICAL_RATE_LIMIT_ENABLE`: 是否启用（默认 true）
- `CRITICAL_RATE_LIMIT`: 请求次数限制（默认 20）
- `CRITICAL_RATE_LIMIT_DURATION`: 时间窗口（秒，默认 1200）

**优势：**
- 每个 IP 每 20 分钟最多 20 次请求
- 有效防止暴力枚举攻击
- 支持 Redis 和内存两种实现方式

---

## 中优先级修复

### 4. 批量操作添加事务保护

**问题描述：**
令牌分组的批量操作（批量更新时长、额度、状态、过期时间）没有使用事务，如果中途失败可能导致数据不一致。

**解决方案：**
为所有批量操作添加数据库事务保护。

**修改文件：** `model/token_group.go`

**修改的函数：**
1. `BatchUpdateTokensExpiredTime` - 批量更新过期时间
2. `BatchSetTokensExpiredTime` - 批量设置过期时间
3. `BatchAddTokensQuota` - 批量增加额度
4. `BatchUpdateTokensStatus` - 批量更新状态

**实现模式：**
```go
// 使用事务
tx := DB.Begin()
if tx.Error != nil {
    return 0, tx.Error
}

result := tx.Model(&Token{}).
    Where("...").
    Update("...", ...)

if result.Error != nil {
    tx.Rollback()
    return 0, result.Error
}

if err := tx.Commit().Error; err != nil {
    return 0, err
}

return result.RowsAffected, nil
```

**优势：**
- 确保批量操作的原子性
- 失败时自动回滚，保证数据一致性
- 兼容所有三种数据库

---

### 5. 竞速请求资源清理优化

**问题描述：**
竞速请求完成后等待 goroutine 清理的超时时间固定为 1 秒，可能不够，导致资源泄漏。

**解决方案：**
使用动态超时时间，基于竞速超时配置自动调整。

**修改文件：** `service/race_request.go`

**实现细节：**
```go
// 超时时间设置为竞速超时的 2 倍，确保有足够时间清理资源
cleanupTimeout := time.Duration(raceSetting.TimeoutMs*2) * time.Millisecond
if cleanupTimeout < 3*time.Second {
    cleanupTimeout = 3 * time.Second // 最少 3 秒
}
if cleanupTimeout > 10*time.Second {
    cleanupTimeout = 10 * time.Second // 最多 10 秒
}
```

**优势：**
- 动态调整超时时间，适应不同的竞速配置
- 最少 3 秒，最多 10 秒，平衡资源清理和响应速度
- 即使超时也不会阻塞主流程
- 添加详细日志，便于监控和调试

---

### 6. 删除分组前的完整性检查

**问题描述：**
删除令牌分组时只检查是否有令牌，但没有检查分组状态，可能删除正在使用的分组配置。

**解决方案：**
增加分组状态检查和日志记录。

**修改文件：** `controller/token_group.go`

**实现细节：**
```go
// 检查分组是否存在
group, err := model.GetTokenGroupById(id, userId)
if err != nil {
    c.JSON(http.StatusOK, gin.H{
        "success": false,
        "message": "令牌分组不存在",
    })
    return
}

// 检查分组状态：如果分组正在使用中，记录日志
if group.Status == model.TokenGroupStatusNormal || group.Status == model.TokenGroupStatusPaused {
    common.SysLog(fmt.Sprintf("Deleting active token group: id=%d, name=%s, status=%d", 
        id, group.Name, group.Status))
}
```

**优势：**
- 先检查分组是否存在，避免无效操作
- 记录活跃分组的删除操作，便于审计
- 保持向后兼容，不改变删除行为
- 为未来可能的更严格检查预留空间

---

## 测试建议

### 1. 激活式令牌并发测试
```bash
# 使用并发工具测试同一令牌的并发激活
# 预期：只有一次激活成功，其他请求获取已激活状态
```

### 2. 令牌状态查询安全测试
```bash
# 测试不同错误情况的返回信息
curl "http://localhost:3000/api/token/status?key=invalid-key"
curl "http://localhost:3000/api/token/status?key=normal-token-key"
# 预期：都返回 "令牌不存在或不可查询"
```

### 3. 速率限制测试
```bash
# 快速发送 25 次请求
for i in {1..25}; do
  curl "http://localhost:3000/api/token/status?key=test" &
done
# 预期：前 20 次成功，后 5 次返回 429 Too Many Requests
```

### 4. 批量操作事务测试
```bash
# 在批量操作中途模拟数据库错误
# 预期：所有更新都回滚，数据保持一致
```

### 5. 竞速请求清理测试
```bash
# 启用竞速请求，观察日志中的 goroutine 清理信息
# 预期：看到 "all goroutines completed successfully" 或超时日志
```

---

## 性能影响评估

### 激活式令牌
- **影响：** 极小
- **原因：** 只在首次激活时增加一次条件检查和可能的重新读取

### 错误信息统一
- **影响：** 无
- **原因：** 只是改变返回的字符串内容

### 批量操作事务
- **影响：** 极小
- **原因：** 事务开销很小，且批量操作本身就不频繁

### 竞速请求清理
- **影响：** 无
- **原因：** 只是调整等待时间，不影响主流程性能

### 删除分组检查
- **影响：** 极小
- **原因：** 只增加一次数据库查询和日志记录

---

## 数据库兼容性

所有修改都经过验证，完全兼容：
- ✅ SQLite
- ✅ MySQL >= 5.7.8
- ✅ PostgreSQL >= 9.6

使用的技术：
- GORM 标准方法
- 条件更新（WHERE 子句）
- 事务（Begin/Commit/Rollback）
- 无数据库特定语法

---

## 回滚方案

如果需要回滚任何改进，可以使用 Git 恢复对应文件：

```bash
# 回滚激活式令牌改进
git checkout HEAD~1 -- model/token.go

# 回滚错误信息统一
git checkout HEAD~1 -- controller/token.go

# 回滚批量操作事务
git checkout HEAD~1 -- model/token_group.go

# 回滚竞速请求清理
git checkout HEAD~1 -- service/race_request.go

# 回滚删除分组检查
git checkout HEAD~1 -- controller/token_group.go
```

---

## 监控建议

### 1. 激活式令牌监控
- 监控日志中的 "Token X already activated, skipping duplicate activation"
- 如果频繁出现，说明并发激活场景较多

### 2. 速率限制监控
- 监控 429 响应的频率
- 如果过高，考虑调整限制参数

### 3. 竞速请求监控
- 监控 "timeout waiting for goroutines" 日志
- 如果频繁出现，考虑增加清理超时时间

### 4. 批量操作监控
- 监控事务回滚的频率
- 如果过高，检查数据库连接和性能

---

## 总结

本次改进涵盖了：
- ✅ 3 个高优先级安全性修复
- ✅ 3 个中优先级稳定性改进
- ✅ 0 个破坏性变更
- ✅ 100% 向后兼容
- ✅ 100% 数据库兼容

所有改进都经过代码审查和编译验证，可以安全上线。
