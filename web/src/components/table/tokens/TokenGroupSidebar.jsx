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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Space,
  Typography,
  Form,
  Input,
  Select,
  Popconfirm,
  Toast,
  Empty,
  Spin,
  Tag,
  Collapse,
  InputNumber,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  List,
  Card,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconMore,
  IconPause,
  IconPlay,
  IconClock,
  IconCreditCard,
  IconStop,
  IconFolder,
  IconFolderOpen,
  IconSetting,
  IconKey,
} from '@douyinfe/semi-icons';
import {
  fetchTokenGroups,
  createTokenGroup,
  updateTokenGroup,
  deleteTokenGroup,
  batchAddDuration,
  batchAddQuota,
  batchSetTokensStatus,
  showError,
  showSuccess,
} from '../../../helpers';

const { Text } = Typography;

// 分组状态映射
const TOKEN_GROUP_STATUS = {
  NORMAL: 0,
  PAUSED: 1,
  DISABLED: 2,
};

const TokenGroupSidebar = ({
  t,
  loading,
  tokenGroups,
  selectedTokenGroup,
  tokenCount,
  groups: channelGroups,
  loadTokenGroups,
  loadTokensByGroup,
  clearGroupFilter,
  onQuickCreateToken,
}) => {
  // 编辑状态
  const [editingGroup, setEditingGroup] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formApi, setFormApi] = useState(null);

  // 批量操作状态
  const [batchOperationGroup, setBatchOperationGroup] = useState(null);
  const [batchOperationType, setBatchOperationType] = useState(null);
  const [batchFormApi, setBatchFormApi] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // 创建分组状态
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormApi, setCreateFormApi] = useState(null);

  const handleEdit = (group) => {
    setEditingGroup(group);
    setShowEditForm(true);
    setShowCreateForm(false);
    setBatchOperationGroup(null);
    setTimeout(() => {
      formApi?.setValues({
        name: group.name,
        description: group.description || '',
        channel_group: group.channel_group || '',
        status: group.status ?? 0,
      });
    }, 0);
  };

  const handleDelete = async (groupId) => {
    try {
      await deleteTokenGroup(groupId);
      showSuccess(t('令牌分组删除成功'));
      loadTokenGroups();
    } catch (error) {
      showError(t(error.message || '删除失败'));
    }
  };

  const handleSubmitEdit = async (values) => {
    try {
      await updateTokenGroup({
        id: editingGroup.id,
        ...values,
      });
      showSuccess(t('令牌分组更新成功'));
      setShowEditForm(false);
      setEditingGroup(null);
      loadTokenGroups();
    } catch (error) {
      showError(t(error.message || '操作失败'));
    }
  };

  const handleSubmitCreate = async (values) => {
    try {
      await createTokenGroup(values);
      showSuccess(t('令牌分组创建成功'));
      setShowCreateForm(false);
      loadTokenGroups();
    } catch (error) {
      showError(t(error.message || '操作失败'));
    }
  };

  // 批量操作处理
  const handleBatchOperation = (group, operationType) => {
    setBatchOperationGroup(group);
    setBatchOperationType(operationType);
    setShowEditForm(false);
    setShowCreateForm(false);
    setTimeout(() => {
      batchFormApi?.reset();
    }, 0);
  };

  const handleBatchSubmit = async (values) => {
    if (!batchOperationGroup || !batchOperationType) return;
    setBatchLoading(true);
    try {
      let result;
      switch (batchOperationType) {
        case 'duration':
          result = await batchAddDuration({
            token_group_id: batchOperationGroup.id,
            days: values.days || 0,
            hours: values.hours || 0,
            minutes: values.minutes || 0,
            seconds: 0,
          });
          showSuccess(t('批量增加时长成功，影响 {{count}} 个令牌', { count: result.affected_count }));
          break;
        case 'quota':
          result = await batchAddQuota({
            token_group_id: batchOperationGroup.id,
            quota: values.quota,
          });
          showSuccess(t('批量增加额度成功，影响 {{count}} 个令牌', { count: result.affected_count }));
          break;
        case 'enable':
          result = await batchSetTokensStatus({
            token_group_id: batchOperationGroup.id,
            status: 1, // 启用
          });
          showSuccess(t('批量启用令牌成功，影响 {{count}} 个令牌', { count: result.affected_count }));
          break;
        case 'disable':
          result = await batchSetTokensStatus({
            token_group_id: batchOperationGroup.id,
            status: 2, // 禁用
          });
          showSuccess(t('批量禁用令牌成功，影响 {{count}} 个令牌', { count: result.affected_count }));
          break;
        default:
          break;
      }
      setBatchOperationGroup(null);
      setBatchOperationType(null);
      loadTokenGroups();
    } catch (error) {
      showError(t(error.message || '批量操作失败'));
    } finally {
      setBatchLoading(false);
    }
  };

  // 更新分组状态
  const handleStatusChange = async (groupId, newStatus) => {
    try {
      await updateTokenGroup({
        id: groupId,
        status: newStatus,
      });
      const statusText = newStatus === TOKEN_GROUP_STATUS.NORMAL
        ? t('正常')
        : newStatus === TOKEN_GROUP_STATUS.PAUSED
          ? t('暂停计时')
          : t('禁用');
      showSuccess(t('分组状态已更新为：{{status}}', { status: statusText }));
      loadTokenGroups();
    } catch (error) {
      showError(t(error.message || '状态更新失败'));
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case TOKEN_GROUP_STATUS.PAUSED:
        return <Tag color="orange" size="small">{t('暂停')}</Tag>;
      case TOKEN_GROUP_STATUS.DISABLED:
        return <Tag color="red" size="small">{t('禁用')}</Tag>;
      default:
        return null;
    }
  };

  const renderBatchOperationForm = () => {
    if (!batchOperationGroup || !batchOperationType) return null;

    let title = '';
    let formContent = null;

    switch (batchOperationType) {
      case 'duration':
        title = t('批量增加时长');
        formContent = (
          <>
            <Form.InputNumber
              field="days"
              label={t('天')}
              min={0}
              placeholder="0"
              style={{ width: '100%' }}
            />
            <Form.InputNumber
              field="hours"
              label={t('小时')}
              min={0}
              max={23}
              placeholder="0"
              style={{ width: '100%' }}
            />
            <Form.InputNumber
              field="minutes"
              label={t('分钟')}
              min={0}
              max={59}
              placeholder="0"
              style={{ width: '100%' }}
            />
            <Text type="tertiary" size="small">
              {t('只对有过期时间的令牌生效')}
            </Text>
          </>
        );
        break;
      case 'quota':
        title = t('批量增加额度');
        formContent = (
          <>
            <Form.InputNumber
              field="quota"
              label={t('额度')}
              min={1}
              placeholder={t('请输入额度')}
              rules={[{ required: true, message: t('请输入额度') }]}
              style={{ width: '100%' }}
            />
            <Text type="tertiary" size="small">
              {t('只对非无限额度的令牌生效')}
            </Text>
          </>
        );
        break;
      case 'enable':
        title = t('批量启用令牌');
        formContent = (
          <Text>{t('确定要启用分组「{{name}}」下的所有令牌吗？', { name: batchOperationGroup.name })}</Text>
        );
        break;
      case 'disable':
        title = t('批量禁用令牌');
        formContent = (
          <Text>{t('确定要禁用分组「{{name}}」下的所有令牌吗？', { name: batchOperationGroup.name })}</Text>
        );
        break;
      default:
        return null;
    }

    return (
      <div className="p-3 bg-blue-50 rounded-lg mb-3 border border-blue-200">
        <div className="flex justify-between items-center mb-3">
          <Text strong>{title}</Text>
          <Button
            type="tertiary"
            size="small"
            onClick={() => {
              setBatchOperationGroup(null);
              setBatchOperationType(null);
            }}
          >
            {t('取消')}
          </Button>
        </div>
        <Form
          getFormApi={(api) => setBatchFormApi(api)}
          onSubmit={handleBatchSubmit}
          layout="horizontal"
          labelPosition="left"
          labelWidth={50}
        >
          {formContent}
          <div className="flex justify-end mt-3">
            <Space>
              <Button
                type="tertiary"
                size="small"
                onClick={() => {
                  setBatchOperationGroup(null);
                  setBatchOperationType(null);
                }}
              >
                {t('取消')}
              </Button>
              <Button type="primary" size="small" htmlType="submit" loading={batchLoading}>
                {t('确定')}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    );
  };

  const renderEditForm = () => {
    if (!showEditForm || !editingGroup) return null;

    return (
      <div className="p-3 bg-gray-50 rounded-lg mb-3 border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <Text strong>{t('编辑分组')}</Text>
          <Button
            type="tertiary"
            size="small"
            onClick={() => {
              setShowEditForm(false);
              setEditingGroup(null);
            }}
          >
            {t('取消')}
          </Button>
        </div>
        <Form
          getFormApi={(api) => setFormApi(api)}
          onSubmit={handleSubmitEdit}
          layout="horizontal"
          labelPosition="left"
          labelWidth={60}
        >
          <Form.Input
            field="name"
            label={t('名称')}
            placeholder={t('请输入分组名称')}
            rules={[{ required: true, message: t('请输入分组名称') }]}
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="description"
            label={t('描述')}
            placeholder={t('请输入描述（可选）')}
            rows={2}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="channel_group"
            label={t('渠道')}
            placeholder={t('请选择渠道分组')}
            style={{ width: '100%' }}
            showClear
          >
            {channelGroups.map((group) => (
              <Select.Option key={group.value} value={group.value}>
                {group.label}
              </Select.Option>
            ))}
          </Form.Select>
          <Form.Select
            field="status"
            label={t('状态')}
            style={{ width: '100%' }}
          >
            <Select.Option value={0}>{t('正常')}</Select.Option>
            <Select.Option value={1}>{t('暂停计时')}</Select.Option>
            <Select.Option value={2}>{t('禁用')}</Select.Option>
          </Form.Select>
          <div className="flex justify-end mt-3">
            <Space>
              <Button
                type="tertiary"
                size="small"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingGroup(null);
                }}
              >
                {t('取消')}
              </Button>
              <Button type="primary" size="small" htmlType="submit">
                {t('保存')}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    );
  };

  // 渲染创建分组弹窗
  const renderCreateModal = () => {
    return (
      <Modal
        title={t('新建分组')}
        visible={showCreateForm}
        onCancel={() => setShowCreateForm(false)}
        onOk={() => createFormApi?.submitForm()}
        maskClosable={false}
        centered
        size="small"
        okText={t('创建')}
        cancelText={t('取消')}
      >
        <Form
          getFormApi={(api) => setCreateFormApi(api)}
          onSubmit={handleSubmitCreate}
          layout="vertical"
          style={{ padding: '8px 0' }}
        >
          <Form.Input
            field="name"
            label={t('名称')}
            placeholder={t('请输入分组名称')}
            rules={[{ required: true, message: t('请输入分组名称') }]}
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="description"
            label={t('描述')}
            placeholder={t('请输入描述（可选）')}
            rows={2}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="channel_group"
            label={t('渠道')}
            placeholder={t('请选择渠道分组')}
            style={{ width: '100%' }}
            showClear
          >
            {channelGroups.map((group) => (
              <Select.Option key={group.value} value={group.value}>
                {group.label}
              </Select.Option>
            ))}
          </Form.Select>
        </Form>
      </Modal>
    );
  };

  const renderGroupItem = (item) => {
    const isSelected = selectedTokenGroup === item.id;
    const isSystem = item.id === null;

    return (
      <List.Item
        className={`cursor-pointer rounded-lg transition-colors ${
          isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
        }`}
        onClick={() => {
          if (item.id === null) {
            clearGroupFilter();
          } else {
            loadTokensByGroup(item.id);
          }
        }}
      >
        <div className="flex items-center gap-2 w-full py-1">
          {isSelected ? (
            <IconFolderOpen className="text-blue-500 flex-shrink-0" />
          ) : (
            <IconFolder className="text-gray-400 flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-sm">{item.name}</span>
          {item.count !== undefined && (
            <Tag size="small" type="light" className="flex-shrink-0">
              {item.count}
            </Tag>
          )}
          {!isSystem && getStatusTag(item.status)}
          {!isSystem && (
            <>
              <Button
                icon={<IconKey />}
                size="small"
                type="tertiary"
                theme="borderless"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickCreateToken?.(item.id);
                }}
                title={t('快捷创建令牌')}
              />
              <Dropdown
                trigger="click"
                position="bottomRight"
                stopPropagation
                clickToHide
                render={
                  <DropdownMenu>
                    <DropdownItem icon={<IconEdit />} onClick={() => handleEdit(item)}>
                      {t('编辑')}
                    </DropdownItem>
                    <DropdownItem
                      icon={<IconKey />}
                      onClick={() => onQuickCreateToken?.(item.id)}
                    >
                      {t('快捷创建令牌')}
                    </DropdownItem>
                    <DropdownItem divider />
                    <DropdownItem
                      icon={<IconClock />}
                      onClick={() => handleBatchOperation(item, 'duration')}
                      disabled={item.count === 0}
                    >
                      {t('批量加时长')}
                    </DropdownItem>
                    <DropdownItem
                      icon={<IconCreditCard />}
                      onClick={() => handleBatchOperation(item, 'quota')}
                      disabled={item.count === 0}
                    >
                      {t('批量加额度')}
                    </DropdownItem>
                    <DropdownItem
                      icon={<IconPlay />}
                      onClick={() => handleBatchOperation(item, 'enable')}
                      disabled={item.count === 0}
                    >
                      {t('批量启用')}
                    </DropdownItem>
                    <DropdownItem
                      icon={<IconStop />}
                      onClick={() => handleBatchOperation(item, 'disable')}
                      disabled={item.count === 0}
                    >
                      {t('批量禁用')}
                    </DropdownItem>
                    <DropdownItem divider />
                    {item.status === TOKEN_GROUP_STATUS.NORMAL ? (
                      <DropdownItem
                        icon={<IconPause />}
                        onClick={() => handleStatusChange(item.id, TOKEN_GROUP_STATUS.PAUSED)}
                      >
                        {t('暂停计时')}
                      </DropdownItem>
                    ) : (
                      <DropdownItem
                        icon={<IconPlay />}
                        onClick={() => handleStatusChange(item.id, TOKEN_GROUP_STATUS.NORMAL)}
                      >
                        {t('恢复正常')}
                      </DropdownItem>
                    )}
                    <DropdownItem divider />
                    <DropdownItem
                      type="danger"
                      icon={<IconDelete />}
                      onClick={() => handleDelete(item.id)}
                    >
                      {t('删除')}
                    </DropdownItem>
                  </DropdownMenu>
                }
              >
                <Button
                  icon={<IconMore />}
                  size="small"
                  type="tertiary"
                  theme="borderless"
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </>
          )}
        </div>
      </List.Item>
    );
  };

  return (
    <Card
      className="h-full"
      title={
        <div className="flex items-center justify-between">
          <span className="font-medium">{t('令牌分组')}</span>
          <Button
            icon={<IconPlus />}
            size="small"
            type="primary"
            theme="light"
            onClick={() => {
              setShowCreateForm(true);
              setShowEditForm(false);
              setBatchOperationGroup(null);
            }}
          >
            {t('新建')}
          </Button>
        </div>
      }
    >
<Spin spinning={loading}>
            {/* 创建分组弹窗 */}
            {renderCreateModal()}

            {/* 编辑表单 */}
            {renderEditForm()}

        {/* 批量操作表单 */}
        {renderBatchOperationForm()}

        {/* 分组列表 */}
        <List
          dataSource={[
            { id: null, name: t('全部令牌'), count: tokenCount },
            ...(tokenGroups || []),
          ]}
          renderItem={renderGroupItem}
          emptyContent={
            <Empty description={t('暂无令牌分组')}>
              <Button
                type="primary"
                icon={<IconPlus />}
                size="small"
                onClick={() => setShowCreateForm(true)}
                className="mt-2"
              >
                {t('创建分组')}
              </Button>
            </Empty>
          }
        />
      </Spin>
    </Card>
  );
};

export default TokenGroupSidebar;
