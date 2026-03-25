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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Input,
  Button,
  Card,
  Descriptions,
  Tag,
  Typography,
  Space,
  Spin,
  Empty,
  Progress,
  Tooltip,
  Banner,
} from '@douyinfe/semi-ui';
import {
  IconKey,
  IconSearch,
  IconCheckCircleStroked,
  IconClose,
  IconClock,
  IconAlertTriangle,
  IconShield,
  IconHourglass,
  IconCoinMoneyStroked,
  IconInfoCircle,
  IconRefresh,
  IconCopy,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';

const { Title, Text } = Typography;

// 动画样式
const animations = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.token-status-page {
  position: relative;
  overflow-x: hidden;
}

.token-status-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.animated-card {
  animation: fadeInUp 0.5s ease-out;
}

.result-card {
  animation: scaleIn 0.4s ease-out;
}

.status-icon-animated {
  animation: pulse 2s ease-in-out infinite;
}

.loading-shimmer {
  background: linear-gradient(
    90deg,
    var(--semi-color-fill-0) 25%,
    var(--semi-color-fill-1) 50%,
    var(--semi-color-fill-0) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.float-animation {
  animation: float 3s ease-in-out infinite;
}

@media (max-width: 768px) {
  .token-status-container {
    padding: 16px !important;
    min-height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .token-status-title {
    font-size: 20px !important;
  }
  
  .token-status-input-group {
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
  }
  
  .token-status-input {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  .token-status-button {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  .token-status-descriptions {
    font-size: 14px;
  }
  
  .token-status-stats {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    gap: 12px !important;
  }
  
  .token-stat-card {
    flex: 1 1 calc(50% - 6px) !important;
    min-width: 140px !important;
    max-width: none !important;
    padding: 12px !important;
  }
  
  .token-stat-value {
    font-size: 16px !important;
  }
  
  .feature-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
}
  
  .token-status-title {
    font-size: 20px !important;
  }
  
  .token-status-input-group {
    flex-direction: column !important;
    align-items: center !important;
  }
  
  .token-status-input {
    width: 100% !important;
  }
  
  .token-status-button {
    width: 100% !important;
  }
  
  .token-status-descriptions {
    font-size: 14px;
  }
  
  .token-status-stats {
    flex-direction: column !important;
    gap: 12px !important;
  }
}

.token-status-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.token-stat-card {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  background: var(--semi-color-bg-1);
  border: 1px solid var(--semi-color-border);
  transition: all 0.3s ease;
}

.token-stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--semi-shadow-elevated);
}

.token-stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.token-stat-value {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.token-stat-label {
  font-size: 12px;
  color: var(--semi-color-text-2);
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.quick-action-btn {
  transition: all 0.2s ease;
}

  .quick-action-btn:hover {
    transform: scale(1.05);
  }

  .decoration-left,
  .decoration-right {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    z-index: 0;
    pointer-events: none;
  }

  .decoration-left {
    left: 40px;
    align-items: flex-start;
  }

  .decoration-right {
    right: 40px;
    align-items: flex-end;
  }

  .decoration-card {
    background: rgba(var(--semi-grey-0), 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(var(--semi-grey-2), 0.3);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    animation: float 6s ease-in-out infinite;
  }

  .decoration-card:nth-child(2) {
    animation-delay: -2s;
  }

  .decoration-card:nth-child(3) {
    animation-delay: -4s;
  }

  .decoration-right .decoration-card {
    flex-direction: row-reverse;
    text-align: right;
  }

  .decoration-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .decoration-icon.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .decoration-icon.success {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
  }

  .decoration-icon.warning {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }

  .decoration-text {
    font-size: 13px;
    color: var(--semi-color-text-1);
    font-weight: 500;
  }

  .decoration-subtext {
    font-size: 11px;
    color: var(--semi-color-text-2);
    margin-top: 2px;
  }

  /* Floating shapes */
  .floating-shape {
    position: fixed;
    border-radius: 50%;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
  }

  .shape-1 {
    width: 300px;
    height: 300px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    top: 10%;
    left: -100px;
    animation: float-slow 20s ease-in-out infinite;
  }

  .shape-2 {
    width: 200px;
    height: 200px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    bottom: 20%;
    left: -50px;
    animation: float-slow 15s ease-in-out infinite reverse;
  }

  .shape-3 {
    width: 250px;
    height: 250px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    top: 15%;
    right: -80px;
    animation: float-slow 18s ease-in-out infinite;
  }

  .shape-4 {
    width: 180px;
    height: 180px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    bottom: 25%;
    right: -40px;
    animation: float-slow 22s ease-in-out infinite reverse;
  }

  @keyframes float-slow {
    0%, 100% {
      transform: translate(0, 0) rotate(0deg);
    }
    25% {
      transform: translate(30px, -30px) rotate(5deg);
    }
    50% {
      transform: translate(0, -50px) rotate(0deg);
    }
    75% {
      transform: translate(-30px, -30px) rotate(-5deg);
    }
  }

  .glowing-dot {
    position: fixed;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--semi-color-primary);
    box-shadow: 0 0 20px var(--semi-color-primary), 0 0 40px var(--semi-color-primary);
    animation: pulse-glow 2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }

  .glowing-dot:nth-child(1) { top: 20%; left: 10%; animation-delay: 0s; }
  .glowing-dot:nth-child(2) { top: 40%; left: 5%; animation-delay: 0.5s; }
  .glowing-dot:nth-child(3) { top: 60%; left: 15%; animation-delay: 1s; }
  .glowing-dot:nth-child(4) { top: 80%; left: 8%; animation-delay: 1.5s; }
  .glowing-dot:nth-child(5) { top: 25%; right: 10%; animation-delay: 0.3s; }
  .glowing-dot:nth-child(6) { top: 45%; right: 5%; animation-delay: 0.8s; }
  .glowing-dot:nth-child(7) { top: 65%; right: 12%; animation-delay: 1.3s; }
  .glowing-dot:nth-child(8) { top: 85%; right: 8%; animation-delay: 1.8s; }

  @keyframes pulse-glow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.5);
    }
  }

  @media (max-width: 1200px) {
    .decoration-left,
    .decoration-right {
      display: none;
    }
  }

  .feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--semi-color-bg-1);
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: var(--semi-color-bg-2);
}

.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
`;

// 浮动装饰组件
const FloatingDecoration = () => {
  return (
    <>
      {/* 左侧装饰 */}
      <div
        style={{
          position: 'fixed',
          left: '5%',
          top: '20%',
          animation: 'float 6s ease-in-out infinite',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.2))',
            filter: 'blur(1px)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
          }}
        />
      </div>
      <div
        style={{
          position: 'fixed',
          left: '8%',
          top: '50%',
          animation: 'float 8s ease-in-out infinite 1s',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
            transform: 'rotate(15deg)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
          }}
        />
      </div>
      <div
        style={{
          position: 'fixed',
          left: '3%',
          bottom: '25%',
          animation: 'float 7s ease-in-out infinite 0.5s',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            border: '2px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '50%',
            animation: 'rotate 20s linear infinite',
          }}
        />
      </div>

      {/* 右侧装饰 */}
      <div
        style={{
          position: 'fixed',
          right: '5%',
          top: '25%',
          animation: 'float 7s ease-in-out infinite 0.5s',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.15))',
            filter: 'blur(1px)',
            boxShadow: '0 8px 28px rgba(236, 72, 153, 0.15)',
          }}
        />
      </div>
      <div
        style={{
          position: 'fixed',
          right: '10%',
          top: '55%',
          animation: 'float 9s ease-in-out infinite 2s',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
      </div>
      <div
        style={{
          position: 'fixed',
          right: '6%',
          bottom: '30%',
          animation: 'float 6s ease-in-out infinite 1.5s',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.1))',
            borderRadius: '20px',
            transform: 'rotate(-10deg)',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.1)',
          }}
        />
      </div>

      {/* 小圆点装饰 */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: i % 2 === 0 ? `${10 + Math.random() * 20}%` : 'auto',
            right: i % 2 === 1 ? `${10 + Math.random() * 20}%` : 'auto',
            top: `${15 + Math.random() * 70}%`,
            width: 8 + Math.random() * 12,
            height: 8 + Math.random() * 12,
            borderRadius: '50%',
            background: `linear-gradient(135deg, 
              rgba(${100 + Math.random() * 155}, ${100 + Math.random() * 155}, 255, ${0.3 + Math.random() * 0.3}),
              rgba(${150 + Math.random() * 105}, ${100 + Math.random() * 155}, 200, ${0.2 + Math.random() * 0.2})
            )`,
            animation: `float ${4 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 2}s`,
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </>
  );
};

// 左侧信息卡片
const LeftInfoCard = () => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'fixed',
        left: '3%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 200,
        zIndex: 0,
        pointerEvents: 'none',
        display: window.innerWidth < 1200 ? 'none' : 'block',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          animation: 'fadeInLeft 1s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🔐
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('安全验证')}</div>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 2 }}>
              {t('密钥全程加密')}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', lineHeight: 1.6 }}>
          {t('查询过程中令牌密钥全程加密传输，仅用于验证身份，不会被存储或记录。')}
        </div>
      </div>
    </div>
  );
};

// 右侧信息卡片
const RightInfoCard = () => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'fixed',
        right: '3%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 200,
        zIndex: 0,
        pointerEvents: 'none',
        display: window.innerWidth < 1200 ? 'none' : 'block',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          animation: 'fadeInRight 1s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ⏱️
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('实时状态')}</div>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 2 }}>
              {t('即时获取信息')}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', lineHeight: 1.6 }}>
          {t('系统会实时返回令牌的当前状态、有效期和剩余额度，确保信息准确无误。')}
        </div>
      </div>
    </div>
  );
};

const TokenStatus = () => {
  const { t } = useTranslation();
  const [tokenKey, setTokenKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [searched, setSearched] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSideCards, setShowSideCards] = useState(true);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 插入动画样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = animations;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleSearch = async () => {
    if (!tokenKey.trim()) {
      showError(t('请输入令牌密钥'));
      return;
    }

    setLoading(true);
    setSearched(true);
    setTokenData(null);

    try {
      const res = await API.get('/api/token/status', {
        params: { key: tokenKey.trim() },
        skipErrorHandler: true,
      });
      const { success, message, data } = res.data;
      if (success) {
        setTokenData(data);
      } else {
        showError(message || t('查询失败'));
      }
    } catch (error) {
      showError(t('查询失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCopyKey = () => {
    if (tokenData?.masked_key) {
      navigator.clipboard.writeText(tokenData.masked_key);
      showSuccess(t('已复制到剪贴板'));
    }
  };

  const handleReset = () => {
    setTokenKey('');
    setTokenData(null);
    setSearched(false);
  };

  const formatDuration = (seconds) => {
    if (seconds <= 0) return t('已过期');
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}${t('天')}`);
    if (hours > 0) parts.push(`${hours}${t('小时')}`);
    if (minutes > 0) parts.push(`${minutes}${t('分钟')}`);
    if (secs > 0 && days === 0) parts.push(`${secs}${t('秒')}`);

    return parts.join(' ') || t('0秒');
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 0 || timestamp === -1) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getStatusConfig = (status) => {
    const configs = {
      not_activated: {
        color: 'grey',
        text: t('未激活'),
        icon: <IconClock className="status-icon-animated" />,
        bgColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 0.3)',
      },
      active: {
        color: 'cyan',
        text: t('已激活'),
        icon: <IconCheckCircleStroked className="status-icon-animated" />,
        bgColor: 'rgba(6, 182, 212, 0.1)',
        borderColor: 'rgba(6, 182, 212, 0.3)',
      },
      expired: {
        color: 'red',
        text: t('已过期'),
        icon: <IconClose className="status-icon-animated" />,
        bgColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
      },
      disabled: {
        color: 'orange',
        text: t('已禁用'),
        icon: <IconAlertTriangle className="status-icon-animated" />,
        bgColor: 'rgba(249, 115, 22, 0.1)',
        borderColor: 'rgba(249, 115, 22, 0.3)',
      },
      exhausted: {
        color: 'purple',
        text: t('已耗尽'),
        icon: <IconAlertTriangle className="status-icon-animated" />,
        bgColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
      },
    };
    return configs[status] || configs.not_activated;
  };

  const getStatusTag = (status) => {
    const config = getStatusConfig(status);
    return (
      <Tag 
        color={config.color} 
        size="large" 
        prefixIcon={config.icon}
        style={{ fontSize: '14px', padding: '4px 12px' }}
      >
        {config.text}
      </Tag>
    );
  };

  const getProgressPercent = () => {
    if (!tokenData?.activated || tokenData.expire_duration <= 0) return 0;
    const elapsed = tokenData.expire_duration - tokenData.remaining_seconds;
    return Math.min(100, Math.max(0, (elapsed / tokenData.expire_duration) * 100));
  };

  const getProgressStatus = () => {
    if (!tokenData) return 'normal';
    if (tokenData.status === 'expired') return 'exception';
    if (tokenData.remaining_seconds < 3600) return 'warning';
    return 'success';
  };

  return (
    <div
      className="token-status-page"
      style={{
        minHeight: '100vh',
        background: 'var(--semi-color-bg-0)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? '20px 16px' : '40px 20px',
        position: 'relative',
      }}
    >
      {/* 浮动装饰 */}
      {!isMobile && <FloatingDecoration />}

      {/* 左侧信息卡片 */}
      {!isMobile && showSideCards && (
        <div className="decoration-left">
          <LeftInfoCard />
        </div>
      )}

      {/* 右侧信息卡片 */}
      {!isMobile && showSideCards && (
        <div className="decoration-right">
          <RightInfoCard />
        </div>
      )}

      {/* 浮动装饰元素 */}
      <FloatingDecoration />

      {/* 主卡片 */}
      <Card
        className="animated-card"
        style={{
          width: '100%',
          maxWidth: 640,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--semi-color-bg-0)',
          position: 'relative',
          zIndex: 1,
          margin: 'auto',
        }}
        bodyStyle={{ padding: isMobile ? '24px 16px' : '40px' }}
      >
        {/* 标题区域 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div 
            className="float-animation"
            style={{
              width: 64,
              height: 64,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
            }}
          >
            <IconShield style={{ fontSize: 32, color: 'white' }} />
          </div>
          <Title 
            heading={isMobile ? 4 : 3} 
            className="token-status-title"
            style={{ 
              marginBottom: 8,
              background: 'linear-gradient(135deg, var(--semi-color-text-0) 0%, var(--semi-color-text-2) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('激活式令牌状态查询')}
          </Title>
          <Text type="tertiary" size="small">
            {t('查询您的激活式令牌状态、有效期及剩余时间')}
          </Text>
        </div>

        {/* 输入区域 */}
        <Space vertical style={{ width: '100%', alignItems: 'center' }} spacing="loose">
          <div 
            className="token-status-input-group"
            style={{ 
              display: 'flex', 
              gap: 12,
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 600,
            }}
          >
            <Input
              className="token-status-input"
              placeholder={t('请输入令牌密钥（支持 sk- 前缀）')}
              prefixIcon={<IconKey />}
              value={tokenKey}
              onChange={setTokenKey}
              onKeyPress={handleKeyPress}
              size="large"
              style={{ 
                flex: 1,
                borderRadius: '12px',
              }}
              showClear
            />
            <Button
              className="token-status-button"
              theme="solid"
              type="primary"
              size="large"
              icon={<IconSearch />}
              loading={loading}
              onClick={handleSearch}
              style={{ 
                borderRadius: '12px',
                minWidth: isMobile ? '100%' : 120,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              {t('查询')}
            </Button>
          </div>

          {/* 快捷操作 */}
          <div className="quick-actions">
            <Tooltip content={t('清空输入')}>
              <Button
                className="quick-action-btn"
                icon={<IconRefresh />}
                type="tertiary"
                size="small"
                onClick={handleReset}
              >
                {t('重置')}
              </Button>
            </Tooltip>
          </div>

          {/* 加载状态 */}
          {loading && (
            <div 
              style={{ 
                textAlign: 'center', 
                padding: '48px 0',
              }}
            >
              <Spin size="large" style={{ marginBottom: 16 }} />
              <Text type="tertiary">{t('正在查询令牌状态...')}</Text>
            </div>
          )}

          {/* 空状态 */}
          {!loading && searched && !tokenData && (
            <Empty
              image={<IconShield style={{ fontSize: 48, opacity: 0.3 }} />}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>
                    {t('未找到相关令牌信息')}
                  </Text>
                  <Text type="tertiary" size="small">
                    {t('请检查令牌密钥是否正确')}
                  </Text>
                </div>
              }
              style={{ padding: '48px 0' }}
            />
          )}

          {/* 结果卡片 */}
          {!loading && tokenData && (
            <div className="result-card">
              {/* 状态横幅 */}
              <Banner
                type={tokenData.status === 'active' ? 'success' : 
                      tokenData.status === 'not_activated' ? 'info' : 'warning'}
                icon={getStatusConfig(tokenData.status).icon}
                title={getStatusConfig(tokenData.status).text}
                description={tokenData.activated 
                  ? t('令牌已激活，有效期内可正常使用')
                  : t('令牌尚未激活，首次使用 API 时将自动激活')
                }
                style={{ 
                  marginBottom: 20, 
                  borderRadius: '12px',
                  background: getStatusConfig(tokenData.status).bgColor,
                  border: `1px solid ${getStatusConfig(tokenData.status).borderColor}`,
                }}
              />

              {/* 统计卡片 */}
              <div className="token-status-stats" style={{ marginBottom: 20 }}>
                <div className="token-stat-card">
                  <div className="token-stat-icon">
                    <IconClock style={{ color: 'var(--semi-color-primary)' }} />
                  </div>
                  <div className="token-stat-value">
                    {tokenData.activated ? formatDuration(tokenData.remaining_seconds) : '-'}
                  </div>
                  <div className="token-stat-label">{t('剩余时间')}</div>
                </div>
                <div className="token-stat-card">
                  <div className="token-stat-icon">
                    <IconHourglass style={{ color: 'var(--semi-color-success)' }} />
                  </div>
                  <div className="token-stat-value">
                    {formatDuration(tokenData.expire_duration)}
                  </div>
                  <div className="token-stat-label">{t('有效时长')}</div>
                </div>
                <div className="token-stat-card">
                  <div className="token-stat-icon">
                    <IconCoinMoneyStroked style={{ color: 'var(--semi-color-warning)' }} />
                  </div>
                  <div className="token-stat-value">
                    {tokenData.unlimited_quota ? t('无限') : tokenData.remain_quota}
                  </div>
                  <div className="token-stat-label">{t('剩余额度')}</div>
                </div>
              </div>

              {/* 进度条 */}
              {tokenData.activated && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text size="small" type="tertiary">{t('有效期进度')}</Text>
                    <Text size="small" type={getProgressStatus() === 'exception' ? 'danger' : 'secondary'}>
                      {Math.round(getProgressPercent())}%
                    </Text>
                  </div>
                  <Progress
                    percent={getProgressPercent()}
                    status={getProgressStatus()}
                    showInfo={false}
                    style={{ marginBottom: 8 }}
                  />
                  <Text size="small" type="tertiary" style={{ textAlign: 'right', display: 'block' }}>
                    {t('过期时间')}: {formatTimestamp(tokenData.expired_time)}
                  </Text>
                </div>
              )}

              {/* 详细信息 */}
              <Card
                style={{
                  background: 'var(--semi-color-bg-1)',
                  borderRadius: '12px',
                  border: '1px solid var(--semi-color-border)',
                }}
                bodyStyle={{ padding: isMobile ? '16px 12px' : '20px' }}
              >
                <Descriptions
                  className="token-status-descriptions"
                  size={isMobile ? 'small' : 'medium'}
                  row
                  data={[
                    {
                      key: t('令牌名称'),
                      value: <Text strong>{tokenData.name || '-'}</Text>,
                    },
                    {
                      key: t('令牌密钥'),
                      value: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text code style={{ fontSize: '12px' }}>{tokenData.masked_key}</Text>
                          <Tooltip content={t('复制')}>
                            <Button
                              icon={<IconCopy />}
                              type="tertiary"
                              size="small"
                              onClick={handleCopyKey}
                            />
                          </Tooltip>
                        </div>
                      ),
                    },
                    {
                      key: t('当前状态'),
                      value: getStatusTag(tokenData.status),
                    },
                    {
                      key: t('激活状态'),
                      value: (
                        <Tag 
                          color={tokenData.activated ? 'green' : 'grey'}
                          size="large"
                          prefixIcon={tokenData.activated ? <IconCheckCircleStroked /> : <IconClock />}
                        >
                          {tokenData.activated ? t('已激活') : t('未激活')}
                        </Tag>
                      ),
                    },
                    ...(tokenData.activated ? [
                      {
                        key: t('激活时间'),
                        value: <Text>{formatTimestamp(tokenData.activated_time)}</Text>,
                      },
                      {
                        key: t('剩余时间'),
                        value: (
                          <Text
                            strong
                            type={
                              tokenData.remaining_seconds > 86400
                                ? 'success'
                                : tokenData.remaining_seconds > 3600
                                  ? 'warning'
                                  : 'danger'
                            }
                            style={{ fontSize: '16px' }}
                          >
                            {formatDuration(tokenData.remaining_seconds)}
                          </Text>
                        ),
                      },
                    ] : []),
                    {
                      key: t('额度状态'),
                      value: tokenData.unlimited_quota ? (
                        <Tag color="green" size="large" prefixIcon={<IconCoinMoneyStroked />}>
                          {t('无限额度')}
                        </Tag>
                      ) : (
                        <Text strong style={{ fontSize: '16px' }}>{tokenData.remain_quota}</Text>
                      ),
                    },
                  ]}
                />
              </Card>

              {/* 提示信息 */}
              <div
                style={{
                  marginTop: 20,
                  padding: '16px 20px',
                  background: 'var(--semi-color-info-light-default)',
                  borderRadius: '12px',
                  border: '1px solid var(--semi-color-info-light-active)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <IconInfoCircle style={{ fontSize: 20, color: 'var(--semi-color-info)', flexShrink: 0 }} />
                <Text type="secondary" size="small" style={{ lineHeight: 1.6 }}>
                  {tokenData.activated
                    ? t('该令牌已激活，请确保在有效期内使用。如需延长有效期，请联系管理员。')
                    : t('该令牌尚未激活，首次调用 API 时将自动激活并开始计算有效期。激活前可正常使用 API。')}
                </Text>
              </div>
            </div>
          )}
        </Space>
      </Card>

      {/* 功能介绍 */}
      {!tokenData && !loading && (
        <div 
          className="feature-grid animated-card"
          style={{ 
            maxWidth: 700, 
            width: '100%',
            marginTop: 32,
          }}
        >
          {[
            {
              icon: <IconShield />,
              title: t('安全可靠'),
              desc: t('密钥全程加密处理，仅显示掩码'),
              color: '#667eea',
            },
            {
              icon: <IconClock />,
              title: t('实时查询'),
              desc: t('实时获取令牌状态和剩余时间'),
              color: '#06b6d4',
            },
            {
              icon: <IconHourglass />,
              title: t('自动激活'),
              desc: t('首次使用 API 自动开始计时'),
              color: '#10b981',
            },
            {
              icon: <IconCoinMoneyStroked />,
              title: t('额度管理'),
              desc: t('查看剩余额度和使用状态'),
              color: '#f59e0b',
            },
          ].map((item, index) => (
            <div 
              key={index} 
              className="feature-item"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div 
                className="feature-icon" 
                style={{ 
                  background: `${item.color}20`,
                  color: item.color,
                }}
              >
                {item.icon}
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>{item.title}</Text>
                <Text type="tertiary" size="small">{item.desc}</Text>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部说明 */}
      <Text
        type="tertiary"
        size="small"
        style={{ 
          marginTop: 32, 
          textAlign: 'center',
          maxWidth: 600,
          lineHeight: 1.6,
        }}
      >
        {t('激活式令牌在首次调用 API 时才会激活并开始计算有效期，适合定期发放或需要控制使用时长的场景。')}
      </Text>
    </div>
  );
};

export default TokenStatus;
