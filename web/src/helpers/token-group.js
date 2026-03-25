/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { API } from './api';

/**
 * 获取用户的所有令牌分组
 * @returns {Promise<Array>} 令牌分组列表
 */
export async function fetchTokenGroups() {
  const response = await API.get('/api/token-group/');
  const { success, data, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to fetch token groups');
  }
  return data || [];
}

/**
 * 获取单个令牌分组
 * @param {number} groupId
 * @returns {Promise<Object>} 令牌分组详情
 */
export async function fetchTokenGroup(groupId) {
  const response = await API.get(`/api/token-group/${groupId}`);
  const { success, data, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to fetch token group');
  }
  return data;
}

/**
 * 获取分组下的令牌列表
 * @param {number} groupId
 * @returns {Promise<Array>} 令牌列表
 */
export async function fetchTokenGroupTokens(groupId) {
  const response = await API.get(`/api/token-group/${groupId}/tokens`);
  const { success, data, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to fetch token group tokens');
  }
  return data || [];
}

/**
 * 创建令牌分组
 * @param {Object} groupData - { name, description, channel_group }
 * @returns {Promise<Object>} 创建的令牌分组
 */
export async function createTokenGroup(groupData) {
  const response = await API.post('/api/token-group/', groupData);
  const { success, data, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to create token group');
  }
  return data;
}

/**
 * 更新令牌分组
 * @param {Object} groupData - { id, name, description, channel_group, status }
 * @returns {Promise<Object>} 更新后的令牌分组
 */
export async function updateTokenGroup(groupData) {
  const response = await API.put('/api/token-group/', groupData);
  const { success, data, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to update token group');
  }
  return data;
}

/**
 * 删除令牌分组
 * @param {number} groupId
 * @returns {Promise<void>}
 */
export async function deleteTokenGroup(groupId) {
  const response = await API.delete(`/api/token-group/${groupId}`);
  const { success, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to delete token group');
  }
}

/**
 * 批量为分组下的令牌增加时长
 * @param {Object} data - { token_group_id, days, hours, minutes, seconds }
 * @returns {Promise<Object>} { affected_count }
 */
export async function batchAddDuration(data) {
  const response = await API.post('/api/token-group/batch/duration', data);
  const { success, data: result, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to add duration');
  }
  return result;
}

/**
 * 批量为分组下的令牌增加额度
 * @param {Object} data - { token_group_id, quota }
 * @returns {Promise<Object>} { affected_count }
 */
export async function batchAddQuota(data) {
  const response = await API.post('/api/token-group/batch/quota', data);
  const { success, data: result, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to add quota');
  }
  return result;
}

/**
 * 批量设置分组下令牌的状态
 * @param {Object} data - { token_group_id, status }
 * @returns {Promise<Object>} { affected_count }
 */
export async function batchSetTokensStatus(data) {
  const response = await API.post('/api/token-group/batch/status', data);
  const { success, data: result, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to set tokens status');
  }
  return result;
}

/**
 * 批量设置分组下所有令牌的过期时间
 * @param {Object} data - { token_group_id, expired_time, never_expire }
 * @returns {Promise<Object>} { affected_count }
 */
export async function batchSetExpiredTime(data) {
  const response = await API.post('/api/token-group/batch/expired-time', data);
  const { success, data: result, message } = response.data || {};
  if (!success) {
    throw new Error(message || 'Failed to set expired time');
  }
  return result;
}
