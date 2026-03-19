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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Table,
  InputNumber,
  Space,
  Card,
  Typography,
  Popconfirm,
  Message,
  Row,
  Col,
  Input,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// 常用模型列表
const COMMON_MODELS = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'gpt-4',
  'gpt-4-32k',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-haiku',
  'claude-3-sonnet',
  'claude-3-opus',
  'claude-3-5-sonnet',
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'minimaxai/minimax-m2.5',
  'minimaxai/minimax-01',
  'deepseek-chat',
  'deepseek-coder',
  'deepseek-reasoner',
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
  'glm-4',
  'glm-4-plus',
  'moonshot-v1-8k',
  'moonshot-v1-32k',
  'moonshot-v1-128k',
  'baichuan2-turbo',
  'abab6.5-chat',
  'abab6.5s-chat',
];

export default function ModelRatioBatchEditor(props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelRatios, setModelRatios] = useState([]);
  const [newModelName, setNewModelName] = useState('');
  const [newModelRatio, setNewModelRatio] = useState(1);
  const { t } = useTranslation();

  // 解析现有的模型倍率
  useEffect(() => {
    try {
      const currentRatio = props.options?.ModelRatio || '{}';
      const ratioMap = JSON.parse(currentRatio);
      
      // 合并已有模型和常用模型
      const allModels = new Set([...Object.keys(ratioMap), ...COMMON_MODELS]);
      
      const models = Array.from(allModels).map((name) => ({
        name,
        ratio: ratioMap[name] !== undefined ? ratioMap[name] : '',
        isCommon: COMMON_MODELS.includes(name),
      }));
      
      // 排序：有倍率的在前，然后是常用模型，最后是其他
      models.sort((a, b) => {
        const aHasRatio = a.ratio !== '';
        const bHasRatio = b.ratio !== '';
        if (aHasRatio && !bHasRatio) return -1;
        if (!aHasRatio && bHasRatio) return 1;
        if (a.isCommon && !b.isCommon) return -1;
        if (!a.isCommon && b.isCommon) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setModelRatios(models);
    } catch (error) {
      showError(t('解析模型倍率失败'));
      console.error(error);
    }
  }, [props.options?.ModelRatio, t]);

  // 更新倍率
  const handleRatioChange = (index, value) => {
    const newModels = [...modelRatios];
    newModels[index].ratio = value;
    setModelRatios(newModels);
  };

  // 删除模型
  const handleDelete = (index) => {
    const newModels = modelRatios.filter((_, i) => i !== index);
    setModelRatios(newModels);
  };

  // 添加新模型
  const handleAddModel = () => {
    if (!newModelName.trim()) {
      showError(t('请输入模型名称'));
      return;
    }
    
    if (modelRatios.some(m => m.name === newModelName.trim())) {
      showError(t('模型已存在'));
      return;
    }
    
    setModelRatios([
      ...modelRatios,
      {
        name: newModelName.trim(),
        ratio: newModelRatio,
        isCommon: false,
      },
    ]);
    setNewModelName('');
    setNewModelRatio(1);
  };

  // 批量设置倍率
  const handleBatchSet = (value) => {
    const newModels = modelRatios.map(m => ({
      ...m,
      ratio: m.ratio === '' ? value : m.ratio,
    }));
    setModelRatios(newModels);
  };

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // 构建 JSON
      const ratioMap = {};
      modelRatios.forEach(m => {
        if (m.ratio !== '' && m.ratio !== null && m.ratio !== undefined) {
          ratioMap[m.name] = Number(m.ratio);
        }
      });
      
      const value = JSON.stringify(ratioMap, null, 2);
      
      const res = await API.put('/api/option/', {
        key: 'ModelRatio',
        value,
      });
      
      if (res.data.success) {
        showSuccess(t('保存成功'));
        props.refresh();
      } else {
        showError(res.data.message || t('保存失败'));
      }
    } catch (error) {
      showError(t('保存失败'));
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'name',
      key: 'name',
      width: '60%',
      render: (text, record) => (
        <Text strong={record.isCommon} type={record.isCommon ? 'primary' : 'secondary'}>
          {text}
          {record.isCommon && (
            <Text type='tertiary' style={{ marginLeft: 8, fontSize: 12 }}>
              ({t('常用')})
            </Text>
          )}
        </Text>
      ),
    },
    {
      title: t('倍率'),
      dataIndex: 'ratio',
      key: 'ratio',
      width: '30%',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          placeholder={t('未设置')}
          min={0}
          step={0.1}
          precision={2}
          style={{ width: 120 }}
          onChange={(value) => handleRatioChange(index, value)}
        />
      ),
    },
    {
      title: t('操作'),
      key: 'action',
      width: '10%',
      render: (_, record, index) => (
        <Popconfirm
          title={t('确定删除')}
          content={t('确定要删除这个模型吗？')}
          onConfirm={() => handleDelete(index)}
        >
          <Button type='danger' theme='borderless' size='small'>
            {t('删除')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 统计信息
  const stats = useMemo(() => {
    const setCount = modelRatios.filter(m => m.ratio !== '').length;
    const unsetCount = modelRatios.filter(m => m.ratio === '').length;
    return { setCount, unsetCount };
  }, [modelRatios]);

  return (
    <Card style={{ marginTop: 10 }}>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={24}>
          <Space wrap>
            <Text type='secondary'>
              {t('已设置')}: {stats.setCount} {t('个模型')}
            </Text>
            <Text type='secondary'>|</Text>
            <Text type='secondary'>
              {t('未设置')}: {stats.unsetCount} {t('个模型')}
            </Text>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12}>
          <Space>
            <Input
              placeholder={t('输入新模型名称')}
              value={newModelName}
              onChange={(value) => setNewModelName(value)}
              style={{ width: 200 }}
            />
            <InputNumber
              placeholder={t('倍率')}
              value={newModelRatio}
              min={0}
              step={0.1}
              precision={2}
              style={{ width: 100 }}
              onChange={setNewModelRatio}
            />
            <Button type='primary' onClick={handleAddModel}>
              {t('添加模型')}
            </Button>
          </Space>
        </Col>
        <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
          <Space>
            <Text type='secondary'>{t('批量设置未配置模型')}:</Text>
            <InputNumber
              placeholder={t('倍率')}
              min={0}
              step={0.1}
              precision={2}
              style={{ width: 100 }}
              onChange={handleBatchSet}
            />
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={modelRatios}
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
        }}
        size='small'
      />

      <Row style={{ marginTop: 20 }}>
        <Col span={24} style={{ textAlign: 'center' }}>
          <Button
            type='primary'
            size='large'
            loading={saving}
            onClick={handleSave}
          >
            {t('保存所有倍率设置')}
          </Button>
        </Col>
      </Row>
    </Card>
  );
}
