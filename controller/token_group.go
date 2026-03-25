package controller

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetTokenGroups 获取用户的所有令牌分组，包含每个分组的令牌数量
type TokenGroupWithCount struct {
	model.TokenGroup
	Count int64 `json:"count"`
}

func GetTokenGroups(c *gin.Context) {
	userId := c.GetInt("id")
	groups, err := model.GetAllUserTokenGroups(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 获取每个分组的令牌数量
	groupsWithCount := make([]TokenGroupWithCount, 0, len(groups))
	for _, group := range groups {
		count, _ := model.CountTokensInTokenGroup(group.Id, userId)
		groupsWithCount = append(groupsWithCount, TokenGroupWithCount{
			TokenGroup: *group,
			Count:      count,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupsWithCount,
	})
}

// GetTokenGroup 获取单个令牌分组
func GetTokenGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	group, err := model.GetTokenGroupById(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    group,
	})
}

// AddTokenGroupRequest 创建令牌分组请求
type AddTokenGroupRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	ChannelGroup string `json:"channel_group"`
}

// AddTokenGroup 创建令牌分组
func AddTokenGroup(c *gin.Context) {
	var req AddTokenGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	// 检查名称长度
	if len(req.Name) > 64 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "名称长度不能超过64个字符",
		})
		return
	}

	group := &model.TokenGroup{
		UserId:       userId,
		Name:         req.Name,
		Description:  req.Description,
		ChannelGroup: req.ChannelGroup,
	}

	if err := group.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    group,
	})
}

// UpdateTokenGroupRequest 更新令牌分组请求
type UpdateTokenGroupRequest struct {
	Id           int    `json:"id" binding:"required"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ChannelGroup string `json:"channel_group"`
	Status       *int   `json:"status"` // 分组状态：0-正常，1-暂停计时，2-禁用
}

// UpdateTokenGroup 更新令牌分组
func UpdateTokenGroup(c *gin.Context) {
	var req UpdateTokenGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	group, err := model.GetTokenGroupById(req.Id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	// 检查名称长度
	if len(req.Name) > 64 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "名称长度不能超过64个字符",
		})
		return
	}

	if req.Name != "" {
		group.Name = req.Name
	}
	group.Description = req.Description
	group.ChannelGroup = req.ChannelGroup
	if req.Status != nil {
		group.Status = *req.Status
	}

	if err := group.Update(); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    group,
	})
}

// DeleteTokenGroup 删除令牌分组
func DeleteTokenGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")

	// 检查分组是否存在
	group, err := model.GetTokenGroupById(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	// 检查分组中是否有令牌
	count, err := model.CountTokensInTokenGroup(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if count > 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该分组中还有令牌，请先移除或转移令牌",
		})
		return
	}

	// 检查分组状态：如果分组正在使用中（状态为正常或暂停），给出警告
	// 虽然没有令牌，但可能有其他配置依赖此分组
	if group.Status == model.TokenGroupStatusNormal || group.Status == model.TokenGroupStatusPaused {
		// 这里只是记录日志，不阻止删除
		// 因为已经确认没有令牌了，删除是安全的
		common.SysLog(fmt.Sprintf("Deleting active token group: id=%d, name=%s, status=%d", id, group.Name, group.Status))
	}

	if err := model.DeleteTokenGroupById(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// BatchAddDurationRequest 批量增加时长请求
type BatchAddDurationRequest struct {
	TokenGroupId int   `json:"token_group_id" binding:"required"`
	Days         int   `json:"days"`
	Hours        int   `json:"hours"`
	Minutes      int   `json:"minutes"`
	Seconds      int   `json:"seconds"` // 额外的秒数
}

// BatchAddDuration 批量为分组下的令牌增加时长
func BatchAddDuration(c *gin.Context) {
	var req BatchAddDurationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	// 验证分组存在
	_, err := model.GetTokenGroupById(req.TokenGroupId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	// 计算总秒数
	totalSeconds := int64(req.Days*24*3600 + req.Hours*3600 + req.Minutes*60 + req.Seconds)
	if totalSeconds <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时长必须大于0",
		})
		return
	}

	affected, err := model.BatchUpdateTokensExpiredTime(req.TokenGroupId, userId, totalSeconds)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"affected_count": affected,
		},
	})
}

// BatchAddQuotaRequest 批量增加额度请求
type BatchAddQuotaRequest struct {
	TokenGroupId int `json:"token_group_id" binding:"required"`
	Quota        int `json:"quota" binding:"required"`
}

// BatchAddQuota 批量为分组下的令牌增加额度
func BatchAddQuota(c *gin.Context) {
	var req BatchAddQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	// 验证分组存在
	_, err := model.GetTokenGroupById(req.TokenGroupId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	if req.Quota <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "额度必须大于0",
		})
		return
	}

	affected, err := model.BatchAddTokensQuota(req.TokenGroupId, userId, req.Quota)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"affected_count": affected,
		},
	})
}

// BatchSetTokensStatusRequest 批量设置令牌状态请求
type BatchSetTokensStatusRequest struct {
	TokenGroupId int `json:"token_group_id" binding:"required"`
	Status       int `json:"status" binding:"required"`
}

// BatchSetTokensStatus 批量设置分组下令牌的状态
func BatchSetTokensStatus(c *gin.Context) {
	var req BatchSetTokensStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	// 验证分组存在
	_, err := model.GetTokenGroupById(req.TokenGroupId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	// 验证状态值
	if req.Status < 1 || req.Status > 4 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的状态值",
		})
		return
	}

	affected, err := model.BatchUpdateTokensStatus(req.TokenGroupId, userId, req.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"affected_count": affected,
		},
	})
}

// BatchSetExpiredTimeRequest 批量设置过期时间请求
type BatchSetExpiredTimeRequest struct {
	TokenGroupId int   `json:"token_group_id" binding:"required"`
	ExpiredTime  int64 `json:"expired_time"` // -1 表示永不过期，其他为 Unix 时间戳
	NeverExpire  bool  `json:"never_expire"` // 是否设置为永不过期
}

// BatchSetExpiredTime 批量设置分组下所有令牌的过期时间
func BatchSetExpiredTime(c *gin.Context) {
	var req BatchSetExpiredTimeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}

	userId := c.GetInt("id")

	// 验证分组存在
	_, err := model.GetTokenGroupById(req.TokenGroupId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	affected, err := model.BatchSetTokensExpiredTime(req.TokenGroupId, userId, req.NeverExpire, req.ExpiredTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"affected_count": affected,
		},
	})
}

// GetTokenGroupTokens 获取分组下的令牌列表
func GetTokenGroupTokens(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")

	// 验证分组存在
	_, err = model.GetTokenGroupById(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组不存在",
		})
		return
	}

	tokens, err := model.GetTokensByTokenGroup(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 清理敏感信息
	for _, token := range tokens {
		token.Clean()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    tokens,
	})
}
