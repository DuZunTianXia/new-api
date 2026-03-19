package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// RaceRequestSetting 竞速请求配置
// 用于处理高负载场景下的请求优化：并发请求多个渠道，首个响应成功的返回给用户
type RaceRequestSetting struct {
	// Enabled 是否启用竞速请求
	Enabled bool `json:"enabled"`
	// Concurrency 并发请求数量（建议 2-3，太多会浪费 quota）
	Concurrency int `json:"concurrency"`
	// StreamEnabled 是否对流式请求启用竞速
	StreamEnabled bool `json:"stream_enabled"`
	// NonStreamEnabled 是否对非流式请求启用竞速
	NonStreamEnabled bool `json:"non_stream_enabled"`
	// TimeoutMs 等待首个响应的超时时间（毫秒），超时后取消所有请求
	TimeoutMs int `json:"timeout_ms"`
}

// 默认配置
var raceRequestSetting = RaceRequestSetting{
	Enabled:          false,
	Concurrency:      2,
	StreamEnabled:    true,
	NonStreamEnabled: false,
	TimeoutMs:        30000, // 30秒
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("race_request_setting", &raceRequestSetting)
}

// GetRaceRequestSetting 获取竞速请求配置
func GetRaceRequestSetting() *RaceRequestSetting {
	return &raceRequestSetting
}

// IsRaceRequestEnabled 是否启用竞速请求
func IsRaceRequestEnabled() bool {
	return raceRequestSetting.Enabled
}

// IsStreamRaceEnabled 是否对流式请求启用竞速
func IsStreamRaceEnabled() bool {
	return raceRequestSetting.Enabled && raceRequestSetting.StreamEnabled
}

// IsNonStreamRaceEnabled 是否对非流式请求启用竞速
func IsNonStreamRaceEnabled() bool {
	return raceRequestSetting.Enabled && raceRequestSetting.NonStreamEnabled
}

// GetRaceConcurrency 获取并发请求数量
func GetRaceConcurrency() int {
	if raceRequestSetting.Concurrency < 2 {
		return 2
	}
	if raceRequestSetting.Concurrency > 5 {
		return 5
	}
	return raceRequestSetting.Concurrency
}

// GetRaceTimeoutMs 获取竞速超时时间（毫秒）
func GetRaceTimeoutMs() int {
	if raceRequestSetting.TimeoutMs <= 0 {
		return 30000
	}
	return raceRequestSetting.TimeoutMs
}
