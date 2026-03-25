package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// TokenGroupStatus 令牌分组状态常量
const (
	TokenGroupStatusNormal   = 0 // 正常
	TokenGroupStatusPaused   = 1 // 暂停计时（维护中）
	TokenGroupStatusDisabled = 2 // 禁用
)

// TokenGroup 令牌分组
type TokenGroup struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"index"`
	Name         string `json:"name" gorm:"size:64;not null"`
	Description  string `json:"description" gorm:"size:256"`
	ChannelGroup string `json:"channel_group" gorm:"size:64;default:''"` // 关联的渠道分组
	Status       int    `json:"status" gorm:"default:0"`                 // 分组状态：0-正常，1-暂停计时，2-禁用
	CreatedTime  int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64  `json:"updated_time" gorm:"bigint"`
}

func (tg *TokenGroup) Insert() error {
	tg.CreatedTime = common.GetTimestamp()
	tg.UpdatedTime = common.GetTimestamp()
	return DB.Create(tg).Error
}

func (tg *TokenGroup) Update() error {
	tg.UpdatedTime = common.GetTimestamp()
	return DB.Model(tg).Select("name", "description", "channel_group", "status", "updated_time").Updates(tg).Error
}

func (tg *TokenGroup) Delete() error {
	return DB.Delete(tg).Error
}

func GetTokenGroupById(id int, userId int) (*TokenGroup, error) {
	if id == 0 || userId == 0 {
		return nil, errors.New("id 或 userId 为空")
	}
	var tg TokenGroup
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&tg).Error
	if err != nil {
		return nil, err
	}
	return &tg, nil
}

func GetAllUserTokenGroups(userId int) ([]*TokenGroup, error) {
	var groups []*TokenGroup
	err := DB.Where("user_id = ?", userId).Order("id desc").Find(&groups).Error
	return groups, err
}

func CountUserTokenGroups(userId int) (int64, error) {
	var count int64
	err := DB.Model(&TokenGroup{}).Where("user_id = ?", userId).Count(&count).Error
	return count, err
}

func CountTokensInTokenGroup(tokenGroupId int, userId int) (int64, error) {
	var count int64
	err := DB.Model(&Token{}).Where("token_group_id = ? AND user_id = ?", tokenGroupId, userId).Count(&count).Error
	return count, err
}

func DeleteTokenGroupById(id int, userId int) error {
	tg, err := GetTokenGroupById(id, userId)
	if err != nil {
		return err
	}
	return tg.Delete()
}

// GetTokenGroupChannelGroup 获取令牌分组关联的渠道分组
// 如果令牌分组不存在或未设置渠道分组，返回空字符串
func GetTokenGroupChannelGroup(tokenGroupId int, userId int) string {
	if tokenGroupId == 0 {
		return ""
	}
	tg, err := GetTokenGroupById(tokenGroupId, userId)
	if err != nil {
		return ""
	}
	return tg.ChannelGroup
}

// GetTokenGroupStatus 获取令牌分组状态
func GetTokenGroupStatus(tokenGroupId int, userId int) int {
	if tokenGroupId == 0 {
		return TokenGroupStatusNormal
	}
	tg, err := GetTokenGroupById(tokenGroupId, userId)
	if err != nil {
		return TokenGroupStatusNormal
	}
	return tg.Status
}

// UpdateTokenGroupStatus 更新令牌分组状态
func UpdateTokenGroupStatus(id int, userId int, status int) error {
	tg, err := GetTokenGroupById(id, userId)
	if err != nil {
		return err
	}
	tg.Status = status
	return tg.Update()
}

// GetTokensByTokenGroup 获取分组下的所有令牌
func GetTokensByTokenGroup(tokenGroupId int, userId int) ([]*Token, error) {
	var tokens []*Token
	err := DB.Where("token_group_id = ? AND user_id = ?", tokenGroupId, userId).Find(&tokens).Error
	return tokens, err
}

// BatchUpdateTokensExpiredTime 批量更新分组下所有令牌的过期时间
// addSeconds 为正数表示延长，负数表示缩短
// 使用事务确保数据一致性
func BatchUpdateTokensExpiredTime(tokenGroupId int, userId int, addSeconds int64) (int64, error) {
	if tokenGroupId == 0 {
		return 0, errors.New("tokenGroupId 不能为空")
	}

	// 使用事务
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}

	// 只更新有过期时间的令牌（expired_time != -1）
	result := tx.Model(&Token{}).
		Where("token_group_id = ? AND user_id = ? AND expired_time != -1", tokenGroupId, userId).
		Update("expired_time", DB.Raw("expired_time + ?", addSeconds))

	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return result.RowsAffected, nil
}

// BatchUpdateTokensStatus 批量更新分组下所有令牌的状态
// 使用事务确保数据一致性
func BatchUpdateTokensStatus(tokenGroupId int, userId int, status int) (int64, error) {
	if tokenGroupId == 0 {
		return 0, errors.New("tokenGroupId 不能为空")
	}

	// 使用事务
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}

	result := tx.Model(&Token{}).
		Where("token_group_id = ? AND user_id = ?", tokenGroupId, userId).
		Update("status", status)

	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return result.RowsAffected, nil
}

// BatchAddTokensQuota 批量为分组下所有令牌增加额度
// 使用事务确保数据一致性
func BatchAddTokensQuota(tokenGroupId int, userId int, quota int) (int64, error) {
	if tokenGroupId == 0 {
		return 0, errors.New("tokenGroupId 不能为空")
	}
	if quota <= 0 {
		return 0, errors.New("quota 必须为正数")
	}

	// 使用事务
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}

	result := tx.Model(&Token{}).
		Where("token_group_id = ? AND user_id = ? AND unlimited_quota = ?", tokenGroupId, userId, false).
		Updates(map[string]interface{}{
			"remain_quota": DB.Raw("remain_quota + ?", quota),
		})

	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return result.RowsAffected, nil
}

// BatchSetTokensExpiredTime 批量设置分组下所有令牌的过期时间
// 设置为永不过期：setToNever = true
// 设置为指定时间：setToNever = false, newExpiredTime 为新时间戳
// 使用事务确保数据一致性
func BatchSetTokensExpiredTime(tokenGroupId int, userId int, setToNever bool, newExpiredTime int64) (int64, error) {
	if tokenGroupId == 0 {
		return 0, errors.New("tokenGroupId 不能为空")
	}

	var newTime interface{} = newExpiredTime
	if setToNever {
		newTime = int64(-1)
	}

	// 使用事务
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}

	result := tx.Model(&Token{}).
		Where("token_group_id = ? AND user_id = ?", tokenGroupId, userId).
		Update("expired_time", newTime)

	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return result.RowsAffected, nil
}
