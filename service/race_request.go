package service

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// 避免未使用导入警告
var _ = dto.Usage{}

// RaceResult 竞速请求结果
type RaceResult struct {
	Index       int                    // 渠道索引
	Channel     *model.Channel         // 渠道信息
	HTTPResp    *http.Response         // HTTP 响应
	Error       *types.NewAPIError     // 错误信息
	RequestBody io.Reader              // 请求体（用于后续处理）
	CancelFunc  context.CancelFunc     // 取消函数
	Ctx         context.Context        // 上下文
	RelayInfo   *relaycommon.RelayInfo // Relay 信息
}

// RaceRequestor 竞速请求器
type RaceRequestor struct {
	Concurrency int                // 并发数量
	Timeout     time.Duration      // 超时时间
	IsStream    bool               // 是否流式请求
	Results     chan *RaceResult   // 结果通道
	Winner      atomic.Int32       // 获胜者索引（-1 表示未决出）
	CancelAll   context.CancelFunc // 取消所有请求
	Ctx         context.Context    // 主上下文
	WaitGroup   sync.WaitGroup     // 等待组
}

// NewRaceRequestor 创建竞速请求器
func NewRaceRequestor(ctx context.Context, concurrency int, timeoutMs int, isStream bool) *RaceRequestor {
	raceCtx, cancelAll := context.WithCancel(ctx)
	return &RaceRequestor{
		Concurrency: concurrency,
		Timeout:     time.Duration(timeoutMs) * time.Millisecond,
		IsStream:    isStream,
		Results:     make(chan *RaceResult, concurrency),
		Winner:      atomic.Int32{}, // 默认值 0
		CancelAll:   cancelAll,
		Ctx:         raceCtx,
	}
}

// GetRaceChannels 获取竞速请求的多个渠道
// 返回指定数量的不同渠道（按优先级和权重选择）
// 只返回启用了竞速请求的渠道
func GetRaceChannels(c *gin.Context, tokenGroup string, modelName string, count int) ([]*model.Channel, string, error) {
	logger.LogInfo(c, fmt.Sprintf("Race request debug: GetRaceChannels start, tokenGroup=%s, modelName=%s, count=%d", tokenGroup, modelName, count))
	if count <= 0 {
		count = 2
	}
	if count > 5 {
		count = 5
	}

	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	selectGroup := tokenGroup
	var channels []*model.Channel

	// 获取可用渠道列表
	if tokenGroup == "auto" {
		autoGroups := GetUserAutoGroup(userGroup)
		logger.LogInfo(c, fmt.Sprintf("Race request debug: auto groups=%v", autoGroups))
		if len(autoGroups) == 0 {
			return nil, selectGroup, fmt.Errorf("auto groups is not enabled")
		}

		// 从所有 auto groups 中收集渠道
		for _, group := range autoGroups {
			groupChannels := getRaceChannelsForGroup(group, modelName, count)
			logger.LogInfo(c, fmt.Sprintf("Race request debug: group=%s, found %d channels", group, len(groupChannels)))
			channels = append(channels, groupChannels...)
		}
		selectGroup = autoGroups[0]
	} else {
		channels = getRaceChannelsForGroup(tokenGroup, modelName, count)
		logger.LogInfo(c, fmt.Sprintf("Race request debug: group=%s, found %d channels", tokenGroup, len(channels)))
	}

	if len(channels) == 0 {
		logger.LogInfo(c, "Race request debug: no channels found")
		return nil, selectGroup, fmt.Errorf("no available channel for model %s", modelName)
	}

	// 过滤：只保留允许参与竞速请求的渠道
	var eligibleChannels []*model.Channel
	for _, ch := range channels {
		enabled := ShouldUseRaceRequestForChannel(ch)
		if ch.RaceRequestEnabled != nil {
			logger.LogInfo(c, fmt.Sprintf("Race request debug: channel_id=%d, name=%s, race_request_enabled=%d, eligible=%v",
				ch.Id, ch.Name, *ch.RaceRequestEnabled, enabled))
		} else {
			logger.LogInfo(c, fmt.Sprintf("Race request debug: channel_id=%d, name=%s, race_request_enabled=nil, eligible=%v",
				ch.Id, ch.Name, enabled))
		}
		if enabled {
			eligibleChannels = append(eligibleChannels, ch)
		}
	}

	if len(eligibleChannels) == 0 {
		logger.LogInfo(c, "Race request debug: no eligible channels after filtering")
		return nil, selectGroup, fmt.Errorf("no eligible channel for race request for model %s", modelName)
	}

	// 去重并限制数量
	eligibleChannels = deduplicateChannels(eligibleChannels)
	if len(eligibleChannels) > count {
		eligibleChannels = eligibleChannels[:count]
	}

	// 打乱顺序以随机化
	shuffleChannels(eligibleChannels)

	// 记录最终选择的渠道
	var channelIds []int
	for _, ch := range eligibleChannels {
		channelIds = append(channelIds, ch.Id)
	}
	logger.LogInfo(c, fmt.Sprintf("Race request debug: selected channels=%v, count=%d", channelIds, len(eligibleChannels)))

	return eligibleChannels, selectGroup, nil
}

// getRaceChannelsForGroup 从指定分组获取竞速渠道
func getRaceChannelsForGroup(group string, modelName string, count int) []*model.Channel {
	// 使用 model 包提供的函数获取竞速渠道
	return model.GetRaceChannelsForGroupFromCache(group, modelName, count)
}

// deduplicateChannels 去重渠道
func deduplicateChannels(channels []*model.Channel) []*model.Channel {
	seen := make(map[int]bool)
	var result []*model.Channel
	for _, ch := range channels {
		if !seen[ch.Id] {
			seen[ch.Id] = true
			result = append(result, ch)
		}
	}
	return result
}

// shuffleChannels 打乱渠道顺序
func shuffleChannels(channels []*model.Channel) {
	rand.Shuffle(len(channels), func(i, j int) {
		channels[i], channels[j] = channels[j], channels[i]
	})
}

// DoRaceRequest 执行竞速请求
// 返回第一个成功的响应
func (r *RaceRequestor) DoRaceRequest(
	c *gin.Context,
	channels []*model.Channel,
	relayInfo *relaycommon.RelayInfo,
	makeRequestFunc func(c *gin.Context, info *relaycommon.RelayInfo, channel *model.Channel) (io.Reader, *types.NewAPIError),
	doRequestFunc func(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, *types.NewAPIError),
) *RaceResult {
	count := len(channels)
	logger.LogInfo(c, fmt.Sprintf("Race request debug: DoRaceRequest start, channel_count=%d, timeout=%v, is_stream=%v", count, r.Timeout, r.IsStream))
	if count == 0 {
		return &RaceResult{
			Error: types.NewError(fmt.Errorf("no channels available for race request"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()),
		}
	}

	// 记录所有参与的渠道
	var channelInfo []string
	for i, ch := range channels {
		concurrency := 0
		if ch.RaceRequestConcurrency != nil {
			concurrency = *ch.RaceRequestConcurrency
		}
		enabled := 0
		if ch.RaceRequestEnabled != nil {
			enabled = *ch.RaceRequestEnabled
		}
		channelInfo = append(channelInfo, fmt.Sprintf("[%d]id=%d,name=%s,enabled=%d,concurrency=%d", i, ch.Id, ch.Name, enabled, concurrency))
	}
	for _, info := range channelInfo {
		logger.LogInfo(c, fmt.Sprintf("Race request debug: channel %s", info))
	}

	// 设置获胜者为 -1（未决出）
	r.Winner.Store(-1)

	// 启动并发请求
	for i, channel := range channels {
		r.WaitGroup.Add(1)
		idx := i
		ch := channel

		gopool.Go(func() {
			defer r.WaitGroup.Done()

			// 为每个请求创建独立的上下文
			reqCtx, cancel := context.WithCancel(r.Ctx)
			defer cancel()

			// 创建请求信息的副本（需要手动复制关键字段）
			infoCopy := copyRelayInfo(relayInfo)

			// 设置渠道上下文
			newAPIError := SetupContextForSelectedChannelWithCancel(c, ch, infoCopy.OriginModelName, reqCtx, cancel)
			if newAPIError != nil {
				r.Results <- &RaceResult{
					Index:   idx,
					Channel: ch,
					Error:   newAPIError,
				}
				return
			}

			// 同步渠道信息到 RelayInfo（确保 infoCopy 包含渠道信息，并传递可取消 context）
			SyncChannelInfoToRelayInfo(infoCopy, ch, reqCtx)

			// 竞速模式下，如果是单渠道多密钥情况，根据索引选择特定密钥
			keys := ch.GetKeys()
			if len(keys) > 1 && count > 1 {
				// 使用索引选择密钥，确保不同竞速请求使用不同密钥
				keyIndex := idx % len(keys)
				selectedKey := keys[keyIndex]
				infoCopy.ApiKey = selectedKey
				// 注意：不修改 gin.Context，避免并发问题
				logger.LogInfo(c, fmt.Sprintf("Race request debug: channel %d using key index %d/%d", ch.Id, keyIndex, len(keys)))
			}

			// 准备请求体
			requestBody, reqErr := makeRequestFunc(c, infoCopy, ch)
			if reqErr != nil {
				r.Results <- &RaceResult{
					Index:   idx,
					Channel: ch,
					Error:   reqErr,
				}
				return
			}

			// 执行请求
			httpResp, respErr := doRequestFunc(c, infoCopy, requestBody)
			if respErr != nil {
				r.Results <- &RaceResult{
					Index:   idx,
					Channel: ch,
					Error:   respErr,
				}
				return
			}

			// 检查响应状态
			if httpResp.StatusCode != http.StatusOK {
				// 解析错误响应
				apiErr := RelayErrorHandler(reqCtx, httpResp, false)
				r.Results <- &RaceResult{
					Index:    idx,
					Channel:  ch,
					HTTPResp: httpResp,
					Error:    apiErr,
				}
				return
			}

			// 成功响应 - 检查是否是第一个成功的
			currentWinner := r.Winner.Load()
			if currentWinner == -1 {
				// 尝试设置为获胜者
				if r.Winner.CompareAndSwap(-1, int32(idx)) {
					// 成功设置为获胜者，取消其他请求
					logger.LogInfo(c, fmt.Sprintf("Race request: channel %d (id=%d) is the winner", idx, ch.Id))
					// 不立即取消所有，让获胜者的响应先返回
					r.Results <- &RaceResult{
						Index:       idx,
						Channel:     ch,
						HTTPResp:    httpResp,
						RequestBody: requestBody,
						CancelFunc:  cancel,
						Ctx:         reqCtx,
						RelayInfo:   infoCopy,
					}
					return
				}
			}

			// 不是获胜者，关闭响应并退出
			httpResp.Body.Close()
			r.Results <- &RaceResult{
				Index:   idx,
				Channel: ch,
				Error:   types.NewError(fmt.Errorf("lost race"), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry()),
			}
		})
	}

	// 等待结果
	timeout := time.NewTimer(r.Timeout)
	defer timeout.Stop()

	// 收集所有结果，返回第一个成功的
	var allResults []*RaceResult
	var successResult *RaceResult
	errorCount := 0

	for {
		select {
		case result := <-r.Results:
			allResults = append(allResults, result)
			if result.Error == nil && result.HTTPResp != nil {
				// 成功响应 - 立即返回获胜者
				if successResult == nil {
					successResult = result
					logger.LogInfo(c, fmt.Sprintf("Race request: winner channel %d (id=%d)", result.Index, result.Channel.Id))
					// 立即取消其他请求（让它们尽快退出）
					r.CancelAll()
					// 启动后台 goroutine 来等待和清理资源
					go func() {
						// 等待其他 goroutine 完成（最多3秒）
						doneChan := make(chan struct{})
						go func() {
							r.WaitGroup.Wait()
							close(doneChan)
						}()
						select {
						case <-doneChan:
						case <-time.After(3 * time.Second):
							logger.LogError(c, "Timeout waiting for race request goroutines to finish")
						}
						// 关闭所有非获胜者的响应体
						for _, res := range allResults {
							if res != successResult && res.HTTPResp != nil && res.HTTPResp.Body != nil {
								res.HTTPResp.Body.Close()
							}
						}
					}()
					// 记录竞速结果统计
					logger.LogInfo(c, fmt.Sprintf("Race request: completed with winner, total_results=%d", len(allResults)))
					for _, res := range allResults {
						if res.Error != nil {
							logger.LogInfo(c, fmt.Sprintf("Race request: channel_id=%d, error=%s", res.Channel.Id, res.Error.Err))
						} else if res == successResult {
							logger.LogInfo(c, fmt.Sprintf("Race request: channel_id=%d, status=winner", res.Channel.Id))
						} else {
							logger.LogInfo(c, fmt.Sprintf("Race request: channel_id=%d, status=lost", res.Channel.Id))
						}
					}
					return successResult
				}
			} else if result.Error != nil && result.Error.GetErrorCode() != types.ErrorCodeDoRequestFailed {
				errorCount++
			}

			// 如果所有请求都失败，退出
			if errorCount >= count {
				goto done
			}

		case <-timeout.C:
			logger.LogError(c, "Race request debug: timeout waiting for results")
			goto done

		case <-r.Ctx.Done():
			logger.LogInfo(c, "Race request debug: context cancelled")
			goto done
		}
	}

done:
	// 取消所有未完成的请求
	r.CancelAll()

	// 等待所有 goroutine 完成（最多1秒）
	doneChan := make(chan struct{})
	go func() {
		r.WaitGroup.Wait()
		close(doneChan)
	}()

	select {
	case <-doneChan:
	case <-time.After(1 * time.Second):
		logger.LogError(c, "Timeout waiting for race request goroutines")
	}

	// 记录竞速结果统计
	logger.LogInfo(c, fmt.Sprintf("Race request debug: completed, total_results=%d, success=%v, error_count=%d",
		len(allResults), successResult != nil, errorCount))
	for _, result := range allResults {
		if result.Error != nil {
			logger.LogInfo(c, fmt.Sprintf("Race request debug: channel_id=%d, error=%s, code=%d",
				result.Channel.Id, result.Error.Err, result.Error.GetErrorCode()))
		} else {
			logger.LogInfo(c, fmt.Sprintf("Race request debug: channel_id=%d, status=success", result.Channel.Id))
		}
	}

	// 返回结果
	if successResult != nil {
		logger.LogInfo(c, fmt.Sprintf("Race request debug: returning success result, winner_channel_id=%d", successResult.Channel.Id))
		return successResult
	}

	// 所有请求都失败了，返回最后一个错误
	logger.LogError(c, fmt.Sprintf("Race request debug: all %d channels failed", len(allResults)))
	for i := len(allResults) - 1; i >= 0; i-- {
		if allResults[i].Error != nil && allResults[i].Error.GetErrorCode() != types.ErrorCodeDoRequestFailed {
			logger.LogError(c, fmt.Sprintf("Race request debug: returning error from channel_id=%d, error=%s", allResults[i].Channel.Id, allResults[i].Error.Err))
			return allResults[i]
		}
	}

	return &RaceResult{
		Error: types.NewError(fmt.Errorf("all race requests failed"), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry()),
	}
}

// SetupContextForSelectedChannelWithCancel 设置选中渠道的上下文（支持取消）
func SetupContextForSelectedChannelWithCancel(c *gin.Context, channel *model.Channel, modelName string, ctx context.Context, cancel context.CancelFunc) *types.NewAPIError {
	// 设置渠道基本信息
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, channel.GetSetting())
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, channel.OtherSettings)
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, channel.GetModelMapping())

	// 设置取消函数
	common.SetContextKey(c, "race_cancel_func", cancel)

	// 设置 API Key
	var apiKey string
	if channel.ChannelInfo.IsMultiKey {
		keys := channel.GetKeys()
		if len(keys) == 0 {
			return types.NewError(fmt.Errorf("channel has no available keys"), types.ErrorCodeChannelNoAvailableKey, types.ErrOptionWithSkipRetry())
		}
		// 根据多 key 模式选择 key
		switch channel.ChannelInfo.MultiKeyMode {
		case constant.MultiKeyModePolling:
			// 轮询模式
			idx := channel.ChannelInfo.MultiKeyPollingIndex % len(keys)
			apiKey = keys[idx]
		default:
			// 默认随机选择
			apiKey = keys[rand.Intn(len(keys))]
		}
	} else {
		apiKey = channel.Key
	}

	common.SetContextKey(c, constant.ContextKeyChannelKey, apiKey)

	// 设置 Base URL
	baseURL := channel.GetBaseURL()
	if baseURL != "" {
		common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, baseURL)
	}

	return nil
}

// SyncChannelInfoToRelayInfo 将渠道信息同步到 RelayInfo
func SyncChannelInfoToRelayInfo(info *relaycommon.RelayInfo, channel *model.Channel, raceCtx context.Context) {
	if info == nil || channel == nil {
		return
	}
	// 确保 ChannelMeta 被初始化（RelayInfo 嵌入了 *ChannelMeta）
	if info.ChannelMeta == nil {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
	}
	info.ChannelId = channel.Id
	info.ChannelType = channel.Type
	info.ChannelBaseUrl = channel.GetBaseURL()
	info.ApiKey = channel.Key
	info.ChannelSetting = channel.GetSetting()
	info.ChannelIsMultiKey = channel.ChannelInfo.IsMultiKey
	// 设置竞速请求的可取消 context
	info.RaceContext = raceCtx
}

// ShouldUseRaceRequest 判断是否应该使用竞速请求
// 优先级：Token 配置 > Channel 配置 > 全局配置
func ShouldUseRaceRequest(c *gin.Context, isStream bool) bool {
	// 1. 检查 Token 级别配置
	tokenRaceEnabled := c.GetInt("token_race_request_enabled")
	logger.LogInfo(c, fmt.Sprintf("Race request debug: token_race_request_enabled=%d", tokenRaceEnabled))
	if tokenRaceEnabled == 1 {
		// Token 明确启用
		logger.LogInfo(c, "Race request: enabled by token config")
		return true
	} else if tokenRaceEnabled == 2 {
		// Token 明确禁用
		logger.LogInfo(c, "Race request: disabled by token config")
		return false
	}

	// 2. 检查全局配置
	raceSetting := operation_setting.GetRaceRequestSetting()
	logger.LogInfo(c, fmt.Sprintf("Race request debug: global enabled=%v, stream_enabled=%v, non_stream_enabled=%v, isStream=%v",
		raceSetting.Enabled, raceSetting.StreamEnabled, raceSetting.NonStreamEnabled, isStream))
	if !raceSetting.Enabled {
		logger.LogInfo(c, "Race request: disabled by global setting")
		return false
	}

	if isStream && !raceSetting.StreamEnabled {
		logger.LogInfo(c, "Race request: disabled for stream by global setting")
		return false
	}

	if !isStream && !raceSetting.NonStreamEnabled {
		logger.LogInfo(c, "Race request: disabled for non-stream by global setting")
		return false
	}

	logger.LogInfo(c, "Race request: enabled by global setting")
	return true
}

// ShouldUseRaceRequestForChannel 判断指定渠道是否应该参与竞速请求
// 优先级：Channel 配置 > 全局配置
func ShouldUseRaceRequestForChannel(channel *model.Channel) bool {
	if channel == nil {
		return false
	}

	// 检查渠道级别的竞速请求配置
	if channel.RaceRequestEnabled != nil {
		switch *channel.RaceRequestEnabled {
		case 1:
			// 渠道明确启用竞速请求
			return true
		case 2:
			// 渠道明确禁用竞速请求
			return false
		}
	}

	// 跟随全局配置
	raceSetting := operation_setting.GetRaceRequestSetting()
	return raceSetting.Enabled
}

// PrepareRaceRequestBody 准备竞速请求的请求体
func PrepareRaceRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, *types.NewAPIError) {
	// 获取请求体存储
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	// 直接使用原始请求体
	return common.ReaderOnly(storage), nil
}

// HandleRaceStreamResponse 处理竞速流式响应
// 当第一个流开始返回数据时，接管该流并取消其他请求
func HandleRaceStreamResponse(c *gin.Context, winner *RaceResult, info *relaycommon.RelayInfo) *types.NewAPIError {
	if winner == nil || winner.HTTPResp == nil {
		return types.NewError(fmt.Errorf("no winner response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	// 设置流式响应头
	helper.SetEventStreamHeaders(c)

	// 检查是否是流式响应
	contentType := winner.HTTPResp.Header.Get("Content-Type")
	isStream := strings.HasPrefix(contentType, "text/event-stream")

	if !isStream {
		// 非流式响应，直接处理
		return handleNonStreamRaceResponse(c, winner, info)
	}

	// 流式响应处理
	streamingTimeout := time.Duration(constant.StreamingTimeout) * time.Second

	var (
		stopChan   = make(chan bool, 3)
		scanner    = bufio.NewScanner(winner.HTTPResp.Body)
		ticker     = time.NewTicker(streamingTimeout)
		writeMutex sync.Mutex
		wg         sync.WaitGroup
	)

	defer func() {
		common.SafeSendBool(stopChan, true)
		ticker.Stop()
		if winner.HTTPResp.Body != nil {
			winner.HTTPResp.Body.Close()
		}
		close(stopChan)
	}()

	scanner.Buffer(make([]byte, 64<<10), 64<<20)
	scanner.Split(bufio.ScanLines)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctx = context.WithValue(ctx, "stop_chan", stopChan)

	// 数据处理通道
	dataChan := make(chan string, 10)

	// 数据写入 goroutine
	wg.Add(1)
	gopool.Go(func() {
		defer wg.Done()
		for data := range dataChan {
			writeMutex.Lock()
			var err error
			if data == "[DONE]" {
				// 发送 [DONE] 消息
				helper.Done(c)
			} else {
				err = helper.StringData(c, data)
			}
			writeMutex.Unlock()
			if err != nil {
				return
			}
		}
	})

	// 扫描 goroutine
	wg.Add(1)
	common.RelayCtxGo(ctx, func() {
		defer func() {
			close(dataChan)
			wg.Done()
		}()

		for scanner.Scan() {
			select {
			case <-stopChan:
				return
			case <-ctx.Done():
				return
			case <-c.Request.Context().Done():
				return
			default:
			}

			ticker.Reset(streamingTimeout)
			data := scanner.Text()

			// 跳过空行
			if len(data) < 6 {
				continue
			}

			// 检查是否是 [DONE] 标记（独立一行）
			if strings.HasPrefix(data, "[DONE]") {
				// 通过 dataChan 发送 [DONE]，确保顺序正确
				select {
				case dataChan <- "[DONE]":
				case <-ctx.Done():
				case <-stopChan:
				}
				return
			}

			// 检查是否是 data: 开头的行
			if !strings.HasPrefix(data, "data:") {
				continue
			}
			data = data[5:]
			data = strings.TrimSpace(data)
			if data == "" {
				continue
			}

			// 处理普通数据行
			if data != "[DONE]" {
				info.SetFirstResponseTime()
				info.ReceivedResponseCount++

				select {
				case dataChan <- data:
				case <-ctx.Done():
					return
				case <-stopChan:
					return
				}
			} else {
				// 通过 dataChan 发送 [DONE]，确保顺序正确
				select {
				case dataChan <- "[DONE]":
				case <-ctx.Done():
				case <-stopChan:
				}
				return
			}
		}
	})

	// 等待 goroutine 完成
	doneChan := make(chan struct{})
	go func() {
		wg.Wait()
		close(doneChan)
	}()

	// 等待完成或超时
	select {
	case <-doneChan:
		logger.LogInfo(c, "streaming finished")
	case <-ticker.C:
		logger.LogError(c, "streaming timeout")
	case <-c.Request.Context().Done():
		logger.LogInfo(c, "client disconnected")
	}

	return nil
}

// handleNonStreamRaceResponse 处理非流式竞速响应
func handleNonStreamRaceResponse(c *gin.Context, winner *RaceResult, info *relaycommon.RelayInfo) *types.NewAPIError {
	// 读取响应体
	body, err := io.ReadAll(winner.HTTPResp.Body)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to read response body: %w", err), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer winner.HTTPResp.Body.Close()

	// 设置响应头
	for key, values := range winner.HTTPResp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// 写入响应
	c.Writer.Write(body)
	return nil
}

// copyRelayInfo 复制 RelayInfo（手动深拷贝关键字段）
func copyRelayInfo(info *relaycommon.RelayInfo) *relaycommon.RelayInfo {
	if info == nil {
		return nil
	}
	// 创建一个新的 RelayInfo，复制关键字段
	// 注意：这里只复制竞速请求需要的字段
	newInfo := &relaycommon.RelayInfo{
		TokenId:            info.TokenId,
		TokenKey:           info.TokenKey,
		TokenGroup:         info.TokenGroup,
		UserId:             info.UserId,
		UsingGroup:         info.UsingGroup,
		UserGroup:          info.UserGroup,
		TokenUnlimited:     info.TokenUnlimited,
		StartTime:          info.StartTime,
		IsStream:           info.IsStream,
		UsePrice:           info.UsePrice,
		OriginModelName:    info.OriginModelName,
		RelayMode:          info.RelayMode,
		RequestURLPath:     info.RequestURLPath,
		Request:            info.Request,
		RelayFormat:        info.RelayFormat,
		UserSetting:        info.UserSetting,
		UserEmail:          info.UserEmail,
		UserQuota:          info.UserQuota,
		ShouldIncludeUsage: info.ShouldIncludeUsage,
		DisablePing:        info.DisablePing,
		ReasoningEffort:    info.ReasoningEffort,
		// RaceContext 会被 SyncChannelInfoToRelayInfo 设置，这里不需要复制
	}

	// 复制 ChannelMeta（嵌入的指针）
	if info.ChannelMeta != nil {
		newInfo.ChannelMeta = &relaycommon.ChannelMeta{
			ChannelType:          info.ChannelType,
			ChannelId:            info.ChannelId,
			ChannelIsMultiKey:    info.ChannelIsMultiKey,
			ChannelMultiKeyIndex: info.ChannelMultiKeyIndex,
			ChannelBaseUrl:       info.ChannelBaseUrl,
			ApiType:              info.ApiType,
			ApiVersion:           info.ApiVersion,
			ApiKey:               info.ApiKey,
			Organization:         info.Organization,
			ChannelCreateTime:    info.ChannelCreateTime,
			ParamOverride:        info.ParamOverride,
			HeadersOverride:      info.HeadersOverride,
			ChannelSetting:       info.ChannelSetting,
			ChannelOtherSettings: info.ChannelOtherSettings,
			UpstreamModelName:    info.UpstreamModelName,
			IsModelMapped:        info.IsModelMapped,
			SupportStreamOptions: info.SupportStreamOptions,
		}
	}

	return newInfo
}

// 避免未使用导入警告
var _ = constant.ContextKeyChannelId

// RaceRequestHelper 竞速请求辅助函数
// 在 relay 流程中调用，处理竞速请求逻辑
// 注意：竞速请求跳过预扣费，只在获胜后结算
func RaceRequestHelper(
	c *gin.Context,
	relayInfo *relaycommon.RelayInfo,
	relayFormat types.RelayFormat,
	priceData types.PriceData,
) *types.NewAPIError {
	logger.LogInfo(c, fmt.Sprintf("Race request debug: RaceRequestHelper start, model=%s, is_stream=%v, token_group=%s",
		relayInfo.OriginModelName, relayInfo.IsStream, relayInfo.TokenGroup))

	// 检查是否启用竞速请求
	if !ShouldUseRaceRequest(c, relayInfo.IsStream) {
		logger.LogInfo(c, "Race request debug: not enabled, returning to normal flow")
		return nil // 不启用竞速请求，返回 nil 让正常流程继续
	}

	// 竞速请求不支持免费模型（需要预扣费逻辑配合）
	if priceData.FreeModel {
		logger.LogInfo(c, "Race request: free model, fallback to normal flow")
		return nil
	}

	raceSetting := operation_setting.GetRaceRequestSetting()
	concurrency := raceSetting.Concurrency
	logger.LogInfo(c, fmt.Sprintf("Race request debug: global setting concurrency=%d, timeout=%d", concurrency, raceSetting.TimeoutMs))
	if concurrency <= 0 {
		concurrency = 2
	}
	if concurrency > 5 {
		concurrency = 5
	}

	// 获取多个竞速渠道
	channels, _, err := GetRaceChannels(c, relayInfo.TokenGroup, relayInfo.OriginModelName, concurrency)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("Race request: failed to get channels: %s", err.Error()))
		return nil // 获取渠道失败，回退到正常流程
	}

	// 处理渠道不足的情况：根据并发数复制渠道，确保能进行竞速
	if len(channels) >= 1 && len(channels) < concurrency {
		logger.LogInfo(c, fmt.Sprintf("Race request debug: expanding %d channels to %d for racing", len(channels), concurrency))
		expandedChannels := make([]*model.Channel, 0, concurrency)
		for i := 0; i < concurrency; i++ {
			// 循环使用现有渠道
			srcChannel := channels[i%len(channels)]
			channelCopy := *srcChannel // 浅拷贝
			expandedChannels = append(expandedChannels, &channelCopy)
		}
		channels = expandedChannels
		logger.LogInfo(c, fmt.Sprintf("Race request: expanded to %d channel copies for racing", len(channels)))
	}

	// 检查第一个渠道是否设置了独立的并发数（优先级：渠道 > 全局）
	if len(channels) > 0 && channels[0] != nil && channels[0].RaceRequestConcurrency != nil && *channels[0].RaceRequestConcurrency > 0 {
		channelConcurrency := *channels[0].RaceRequestConcurrency
		if channelConcurrency < concurrency {
			logger.LogInfo(c, fmt.Sprintf("Race request: using channel-specific concurrency %d (global: %d)", channelConcurrency, concurrency))
			concurrency = channelConcurrency
			// 重新调整渠道数量以匹配并发数
			if len(channels) > concurrency {
				channels = channels[:concurrency]
			} else if len(channels) < concurrency {
				// 需要扩展渠道数量
				expandedChannels := make([]*model.Channel, 0, concurrency)
				for i := 0; i < concurrency; i++ {
					srcChannel := channels[i%len(channels)]
					channelCopy := *srcChannel
					expandedChannels = append(expandedChannels, &channelCopy)
				}
				channels = expandedChannels
			}
		}
	}

	logger.LogInfo(c, fmt.Sprintf("Race request: starting with %d channels", len(channels)))

	// 创建竞速请求器
	raceRequestor := NewRaceRequestor(c.Request.Context(), len(channels), raceSetting.TimeoutMs, relayInfo.IsStream)

	// 执行竞速请求
	result := raceRequestor.DoRaceRequest(
		c,
		channels,
		relayInfo,
		makeRaceRequestBody,
		doRaceHTTPRequest,
	)

	if result.Error != nil {
		logger.LogError(c, fmt.Sprintf("Race request: all channels failed: %s", result.Error.Error()))
		return result.Error
	}

	// 记录使用的渠道
	addUsedChannel(c, result.Channel.Id)

	// 处理响应（包含计费）
	handleErr := handleRaceResponse(c, result, relayInfo, priceData)

	// 等待所有 goroutine 完成，使用更合理的超时时间
	// 超时时间设置为竞速超时的 2 倍，确保有足够时间清理资源
	cleanupTimeout := time.Duration(raceSetting.TimeoutMs*2) * time.Millisecond
	if cleanupTimeout < 3*time.Second {
		cleanupTimeout = 3 * time.Second // 最少 3 秒
	}
	if cleanupTimeout > 10*time.Second {
		cleanupTimeout = 10 * time.Second // 最多 10 秒
	}

	doneChan := make(chan struct{})
	go func() {
		raceRequestor.WaitGroup.Wait()
		close(doneChan)
	}()

	select {
	case <-doneChan:
		logger.LogInfo(c, "Race request: all goroutines completed successfully")
	case <-time.After(cleanupTimeout):
		logger.LogError(c, fmt.Sprintf("Race request: timeout waiting for goroutines to finish after %v", cleanupTimeout))
		// 即使超时也继续，避免阻塞主流程
		// goroutine 会在后台自然完成
	}

	return handleErr
}

// handleRaceResponse 处理竞速响应（包含计费）
func handleRaceResponse(c *gin.Context, winner *RaceResult, relayInfo *relaycommon.RelayInfo, priceData types.PriceData) *types.NewAPIError {
	if winner == nil || winner.HTTPResp == nil {
		return types.NewError(fmt.Errorf("no winner response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	// 设置流式响应头
	if relayInfo.IsStream {
		helper.SetEventStreamHeaders(c)
	}

	// 检查是否是流式响应
	contentType := winner.HTTPResp.Header.Get("Content-Type")
	isStream := strings.HasPrefix(contentType, "text/event-stream")

	if !isStream {
		// 非流式响应处理
		return handleNonStreamRaceResponseWithBilling(c, winner, relayInfo, priceData)
	}

	// 流式响应处理
	return handleStreamRaceResponseWithBilling(c, winner, relayInfo, priceData)
}

// handleStreamRaceResponseWithBilling 处理流式竞速响应（包含计费）
func handleStreamRaceResponseWithBilling(c *gin.Context, winner *RaceResult, relayInfo *relaycommon.RelayInfo, priceData types.PriceData) *types.NewAPIError {
	var (
		usage *dto.Usage
	)

	// 使用 helper.StreamScannerHandler 直接转发上游 SSE 流，避免重复实现
	helper.StreamScannerHandler(c, winner.HTTPResp, relayInfo, func(data string) bool {
		// 收集 usage（上游可能在最后一条 data 中包含 usage 信息）
		if strings.Contains(data, `"usage"`) {
			parsedUsage := parseUsageFromStreamData(data)
			if parsedUsage != nil {
				usage = parsedUsage
			}
		}
		// 直接转发原始 JSON 数据给客户端
		if err := helper.StringData(c, data); err != nil {
			logger.LogError(c, fmt.Sprintf("Race request: stream write error: %s", err.Error()))
			return false
		}
		return true
	})

	// 流式结束后发送 [DONE]
	helper.Done(c)

	// 结算计费
	if usage != nil && relayInfo.Billing != nil {
		actualQuota := calculateActualQuota(usage, priceData)
		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			logger.LogError(c, fmt.Sprintf("Race request: billing settle failed: %s", err.Error()))
		}
	}

	// 记录使用日志
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	tokenName := c.GetString("token_name")
	content := fmt.Sprintf("竞速请求成功 | 渠道: %d", winner.Channel.Id)
	other := map[string]interface{}{
		"model_ratio":      priceData.ModelRatio,
		"group_ratio":      priceData.GroupRatioInfo.GroupRatio,
		"completion_ratio": priceData.CompletionRatio,
		"model_price":      priceData.ModelPrice,
		"is_race_request":  true,
	}

	promptTokens := 0
	completionTokens := 0
	if usage != nil {
		promptTokens = usage.InputTokens
		completionTokens = usage.OutputTokens
	}

	actualQuota := calculateActualQuota(usage, priceData)
	model.RecordConsumeLog(c, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        winner.Channel.Id,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ModelName:        relayInfo.OriginModelName,
		TokenName:        tokenName,
		Quota:            actualQuota,
		Content:          content,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})

	return nil
}

// handleNonStreamRaceResponseWithBilling 处理非流式竞速响应（包含计费）
func handleNonStreamRaceResponseWithBilling(c *gin.Context, winner *RaceResult, relayInfo *relaycommon.RelayInfo, priceData types.PriceData) *types.NewAPIError {
	// 读取响应体
	body, err := io.ReadAll(winner.HTTPResp.Body)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to read response body: %w", err), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer winner.HTTPResp.Body.Close()

	// 设置响应头
	for key, values := range winner.HTTPResp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// 写入响应
	c.Writer.Write(body)

	// 解析 usage 并结算计费
	usage := parseUsageFromResponse(body)
	if usage != nil && relayInfo.Billing != nil {
		actualQuota := calculateActualQuota(usage, priceData)
		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			logger.LogError(c, fmt.Sprintf("Race request: billing settle failed: %s", err.Error()))
		}
	}

	// 记录使用日志
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	tokenName := c.GetString("token_name")
	content := fmt.Sprintf("竞速请求成功 | 渠道: %d", winner.Channel.Id)
	other := map[string]interface{}{
		"model_ratio":      priceData.ModelRatio,
		"group_ratio":      priceData.GroupRatioInfo.GroupRatio,
		"completion_ratio": priceData.CompletionRatio,
		"model_price":      priceData.ModelPrice,
		"is_race_request":  true,
	}

	promptTokens := 0
	completionTokens := 0
	if usage != nil {
		promptTokens = usage.InputTokens
		completionTokens = usage.OutputTokens
	}

	actualQuota := calculateActualQuota(usage, priceData)
	model.RecordConsumeLog(c, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        winner.Channel.Id,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ModelName:        relayInfo.OriginModelName,
		TokenName:        tokenName,
		Quota:            actualQuota,
		Content:          content,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})

	return nil
}

// parseUsageFromStreamData 从流式数据解析 usage
func parseUsageFromStreamData(data string) *dto.Usage {
	// 尝试解析 OpenAI 格式的 usage
	var streamResp struct {
		Usage *dto.Usage `json:"usage"`
	}
	if err := common.UnmarshalJsonStr(data, &streamResp); err == nil && streamResp.Usage != nil {
		return streamResp.Usage
	}
	return nil
}

// parseUsageFromResponse 从响应体解析 usage
func parseUsageFromResponse(body []byte) *dto.Usage {
	// 尝试解析 OpenAI 格式的响应
	var resp struct {
		Usage *dto.Usage `json:"usage"`
	}
	if err := common.Unmarshal(body, &resp); err == nil && resp.Usage != nil {
		return resp.Usage
	}
	return nil
}

// calculateActualQuota 计算实际配额
func calculateActualQuota(usage *dto.Usage, priceData types.PriceData) int {
	if usage == nil {
		return 0
	}

	// 简化计算：使用 prompt tokens + completion tokens
	totalTokens := usage.PromptTokens + usage.CompletionTokens
	if totalTokens == 0 {
		return 0
	}

	// 根据价格数据计算实际配额
	// 这里使用简化逻辑，实际应该使用完整的计费计算
	return int(float64(totalTokens) * priceData.ModelRatio * priceData.GroupRatioInfo.GroupRatio)
}

// makeRaceRequestBody 创建竞速请求体
func makeRaceRequestBody(c *gin.Context, info *relaycommon.RelayInfo, channel *model.Channel) (io.Reader, *types.NewAPIError) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		return nil, types.NewError(fmt.Errorf("failed to read request body: %w", err), types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
	}
	return bytes.NewReader(bodyBytes), nil
}

// doRaceHTTPRequest 执行竞速 HTTP 请求
func doRaceHTTPRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, *types.NewAPIError) {
	// 获取 HTTP 客户端
	var client *http.Client
	var err error
	channelSetting := info.ChannelSetting
	if channelSetting.Proxy != "" {
		client, err = NewProxyHttpClient(channelSetting.Proxy)
		if err != nil {
			return nil, types.NewError(fmt.Errorf("new proxy http client failed: %w", err), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
		}
	} else {
		client = GetHttpClient()
	}

	// 构建请求 URL
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[info.ChannelType]
	}

	// 根据渠道类型构建 URL
	var fullRequestURL string
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		fullRequestURL = fmt.Sprintf("%s/v1/chat/completions", baseURL)
	case relayconstant.RelayModeEmbeddings:
		fullRequestURL = fmt.Sprintf("%s/v1/embeddings", baseURL)
	case relayconstant.RelayModeCompletions:
		fullRequestURL = fmt.Sprintf("%s/v1/completions", baseURL)
	default:
		fullRequestURL = fmt.Sprintf("%s/v1/chat/completions", baseURL)
	}

	// 创建 HTTP 请求
	// 注意：这里使用 context.Background()，因为 Go 的 http.Client.Do() 在 context 取消时会关闭响应体
	// 如果使用可取消的 context，当 CancelAll() 被调用时，获胜者的响应体也会被关闭
	req, err := http.NewRequestWithContext(context.Background(), "POST", fullRequestURL, requestBody)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("new request failed: %w", err), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	// 设置 Accept 头，确保上游返回流式响应
	if info.IsStream {
		req.Header.Set("Accept", "text/event-stream")
	}

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("do request failed: %w", err), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}

	return resp, nil
}

// addUsedChannel 记录使用的渠道
func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}
