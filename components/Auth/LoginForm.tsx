import React, { useState, useEffect, useRef } from 'react';
import { useCloudBaseAuth } from '../../contexts/CloudBaseAuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
  onBackToHome?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onBackToHome }) => {
  const { signIn, signUp, isConfigured } = useCloudBaseAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 流星动画效果
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Meteor {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
      color: string;
    }

    const meteors: Meteor[] = [];

    // 创建流星
    const createMeteor = () => {
      return {
        x: Math.random() * canvas.width + canvas.width * 0.2,
        y: -50,
        length: Math.random() * 80 + 60,
        speed: Math.random() * 8 + 6,
        opacity: Math.random() * 0.5 + 0.5,
        color: ['#FFD700', '#9333EA', '#3B82F6'][Math.floor(Math.random() * 3)]
      };
    };

    // 初始化更多流星
    for (let i = 0; i < 8; i++) {
      meteors.push(createMeteor());
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 增加流星生成频率和数量
      if (Math.random() < 0.08 && meteors.length < 20) {
        meteors.push(createMeteor());
      }

      // 更新和绘制流星
      meteors.forEach((meteor, index) => {
        meteor.x -= meteor.speed;
        meteor.y += meteor.speed;

        // 绘制流星尾迹
        const gradient = ctx.createLinearGradient(
          meteor.x,
          meteor.y,
          meteor.x + meteor.length,
          meteor.y - meteor.length
        );
        gradient.addColorStop(0, meteor.color);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x + meteor.length, meteor.y - meteor.length);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.globalAlpha = meteor.opacity;
        ctx.stroke();

        // 绘制流星头部光点
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = meteor.color;
        ctx.globalAlpha = meteor.opacity;
        ctx.fill();

        // 移除超出屏幕的流星
        if (meteor.x < -meteor.length || meteor.y > canvas.height + 50) {
          meteors.splice(index, 1);
        }
      });

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-200 mb-2">CloudBase 未配置</h2>
          <p className="text-slate-400 text-sm mb-6">
            云端同步功能需要配置腾讯云 CloudBase。请在 .env.local 文件中添加 VITE_TCB_ENV_ID。
          </p>
          <p className="text-slate-500 text-xs">
            您仍然可以使用本地存储模式继续创作。
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('请填写所有字段');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(username.toLowerCase().trim(), password);
        if (error) {
          setError(error.message || '用户名或密码错误');
        } else {
          onSuccess?.();
        }
      } else {
        const { error } = await signUp(username.toLowerCase().trim(), password);
        if (error) {
          setError(error.message);
        } else {
          alert('✅ 注册成功!正在自动登录...');
          onSuccess?.();
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        setError('⚠️ 网络连接失败,无法访问 CloudBase。请检查网络或切换到本地存储模式。');
      } else {
        setError(err.message || '操作失败,请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Static starry background - always visible */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                           radial-gradient(2px 2px at 60% 70%, white, transparent),
                           radial-gradient(1.5px 1.5px at 50% 50%, white, transparent),
                           radial-gradient(1.5px 1.5px at 80% 10%, white, transparent),
                           radial-gradient(2px 2px at 90% 60%, white, transparent),
                           radial-gradient(1px 1px at 25% 40%, rgba(251, 191, 36, 0.6), transparent),
                           radial-gradient(1px 1px at 75% 80%, rgba(147, 51, 234, 0.6), transparent),
                           radial-gradient(1px 1px at 45% 65%, rgba(59, 130, 246, 0.6), transparent)`,
          backgroundSize: '200px 200px, 300px 300px, 250px 250px, 400px 400px, 350px 350px, 180px 180px, 220px 220px, 190px 190px',
          backgroundPosition: '0 0, 40px 60px, 130px 270px, 70px 100px, 200px 150px, 80px 180px, 240px 90px, 160px 240px',
          opacity: 0.5
        }} />
      </div>

      {/* 星空背景图 - 可选增强 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/bg-login.png)', opacity: 0.3 }}
      />

      {/* 流星动画 Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0"
        style={{ opacity: 0.9 }}
      />

      {/* Animated Background Orbs - 深色奢华配色 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse z-0" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse z-0" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="relative group inline-block cursor-pointer"
            onClick={() => onBackToHome?.()}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-3xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl mx-auto ring-4 ring-amber-500/30">
              <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1
            className="text-4xl font-bold mt-6 bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onBackToHome?.()}
          >
            晨曦遗墨
          </h1>
        </div>

        {/* Form Card */}
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Card Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-purple-600/5 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                className={`relative flex-1 py-2 rounded-2xl font-semibold transition-all overflow-hidden ${
                  isLogin ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isLogin && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 blur-lg opacity-50" />
                  </>
                )}
                {!isLogin && (
                  <div className="absolute inset-0 bg-white/5" />
                )}
                <span className="relative">登录</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
                className={`relative flex-1 py-2 rounded-2xl font-semibold transition-all overflow-hidden ${
                  !isLogin ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {!isLogin && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 blur-lg opacity-50" />
                  </>
                )}
                {isLogin && (
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
                )}
                <span className="relative">注册</span>
              </button>
            </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full backdrop-blur-xl bg-slate-900/80 border border-amber-500/40 rounded-2xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                placeholder="输入用户名"
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full backdrop-blur-xl bg-slate-900/80 border border-amber-500/40 rounded-2xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                  placeholder="至少 6 位"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* 确认密码字段 - 固定高度88px，登录和注册都保持相同高度 */}
            <div className="relative" style={{ height: '88px' }}>
              <div
                className="absolute inset-0 transition-all duration-700 ease-in-out"
                style={{
                  opacity: isLogin ? 0 : 1,
                  transform: isLogin ? 'translateY(-20px) scale(0.95)' : 'translateY(0) scale(1)',
                  pointerEvents: isLogin ? 'none' : 'auto'
                }}
              >
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full backdrop-blur-xl bg-slate-900/80 border border-amber-500/40 rounded-2xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                    placeholder="再次输入密码"
                    disabled={loading || isLogin}
                    tabIndex={isLogin ? -1 : 0}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 transition-colors"
                    tabIndex={isLogin ? -1 : 0}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-3 text-white rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden group shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 blur-xl opacity-50" />
              <span className="relative">
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    处理中...
                  </>
                ) : (
                  <span>{isLogin ? '登录' : '注册账号'}</span>
                )}
              </span>
            </button>

            {/* Skip login button */}
            <button
              type="button"
              onClick={() => {
                // Clear Supabase config to trigger local mode
                localStorage.setItem('inkflow_use_local_mode', 'true');
                window.location.reload();
              }}
              className="w-full py-2 backdrop-blur-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 hover:text-white rounded-2xl font-medium transition-all text-sm border border-amber-500/30 hover:border-amber-500/50"
            >
              跳过登录,使用本地存储模式
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-amber-500/20 text-center text-xs text-slate-400">
            <p>数据将安全存储在云端,支持多设备同步</p>
          </div>
        </div>
      </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>© 2026 晨曦遗墨. All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
