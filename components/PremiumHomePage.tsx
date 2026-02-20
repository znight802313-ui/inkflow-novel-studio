import React, { useEffect, useRef, useState } from 'react';
import BookCarousel from './BookCarousel';

interface PremiumHomePageProps {
  onGetStarted: () => void;
  projects?: Array<{
    _id: string;
    title: string;
    coverImage?: string;
    chapterCount?: number;
  }>;
  onSelectProject?: (projectId: string) => void;
}

const PremiumHomePage: React.FC<PremiumHomePageProps> = ({ onGetStarted, projects = [], onSelectProject }) => {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Demo books
  const demoBooks = [
    { id: 'demo1', title: '星辰之海', cover: '/book1.jpg', author: '晨曦遗墨', chapters: 24 },
    { id: 'demo2', title: '时光旅人', cover: '/book2.jpg', author: '晨曦遗墨', chapters: 18 },
    { id: 'demo3', title: '魔法学院', cover: '/book3.jpg', author: '晨曦遗墨', chapters: 32 },
    { id: 'demo4', title: '都市传说', cover: '/book4.jpg', author: '晨曦遗墨', chapters: 15 },
    { id: 'demo5', title: '异世界冒险', cover: '/book5.jpg', author: '晨曦遗墨', chapters: 28 },
    { id: 'demo6', title: '青春物语', cover: '/book6.jpg', author: '晨曦遗墨', chapters: 20 },
    { id: 'demo7', title: '末日余晖', cover: '/book7.jpg', author: '晨曦遗墨', chapters: 36 },
    { id: 'demo8', title: '仙侠传奇', cover: '/book8.jpg', author: '晨曦遗墨', chapters: 42 },
    { id: 'demo9', title: '悬疑档案', cover: '/book9.jpg', author: '晨曦遗墨', chapters: 16 },
    { id: 'demo10', title: '科幻纪元', cover: '/book10.jpg', author: '晨曦遗墨', chapters: 30 },
    { id: 'demo11', title: '奇幻之旅', cover: '/book11.jpg', author: '晨曦遗墨', chapters: 25 }
  ];

  const userBooks = projects.map(p => ({
    id: p._id,
    title: p.title,
    cover: p.coverImage || '/cover1.png',
    author: '我的作品',
    chapters: p.chapterCount || 0
  }));

  const displayBooks = userBooks.length > 0 ? userBooks : demoBooks;

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mouse tracking for 3D effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Animated particles canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      color: string;
    }> = [];

    // Create more particles with enhanced effects
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        size: Math.random() * 4 + 1.5,
        opacity: Math.random() * 0.7 + 0.3,
        color: ['#FFD700', '#9333EA', '#3B82F6'][Math.floor(Math.random() * 3)]
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.fill();

        // Draw connections
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 200) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = (1 - distance / 200) * 0.4;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
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

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Hero Section with Parallax */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Parallax */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/bg-hero.png)',
            transform: `translateY(${scrollY * 0.5}px)`,
            filter: 'brightness(0.7)'
          }}
        />

        {/* Animated Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.6 }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />

        {/* 3D Floating Elements */}
        <div
          className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full blur-3xl"
          style={{
            transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-br from-amber-600/20 to-purple-600/20 rounded-full blur-3xl"
          style={{
            transform: `translate(${-mousePos.x * 40}px, ${-mousePos.y * 40}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Logo with 3D effect - 优化融合效果 */}
          <div
            className="mb-12 inline-block relative"
            style={{
              transform: `perspective(1000px) rotateX(${mousePos.y * 5}deg) rotateY(${mousePos.x * 5}deg)`,
              transition: 'transform 0.3s ease-out'
            }}
          >
            {/* Logo 背景光晕 */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-purple-600/30 to-blue-600/30 rounded-full blur-3xl scale-150 animate-pulse" />

            {/* Logo 容器 */}
            <div className="relative backdrop-blur-sm bg-white/5 border border-amber-500/20 rounded-3xl p-6 shadow-2xl">
              <img
                src="/logo-new.png"
                alt="晨曦遗墨"
                className="w-28 h-28 mx-auto drop-shadow-2xl relative z-10"
                style={{ filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.5))' }}
              />
            </div>
          </div>

          {/* Title with gradient and glow - 清晰的立体阴影 */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif mb-10 leading-none" style={{ fontFamily: "'Noto Serif SC', 'STKaiti', 'KaiTi', serif", fontWeight: 900, letterSpacing: '0.2em' }}>
            <span
              className="bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-gradient"
              style={{
                filter: 'drop-shadow(0 2px 0 rgba(0, 0, 0, 0.8)) drop-shadow(0 4px 0 rgba(0, 0, 0, 0.6)) drop-shadow(0 6px 0 rgba(0, 0, 0, 0.4)) drop-shadow(0 8px 0 rgba(0, 0, 0, 0.2)) drop-shadow(0 12px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 40px rgba(251, 191, 36, 0.3))'
              }}
            >
              晨曦遗墨
            </span>
          </h1>

          {/* Subtitle with glassmorphism - 优化布局 */}
          <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border border-amber-500/20 rounded-3xl px-12 py-8 mb-12 shadow-2xl max-w-4xl mx-auto relative overflow-hidden">
            {/* 装饰性光晕 */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

            {/* 左右装饰 */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-transparent via-purple-500/50 to-transparent" />

            <div className="text-center space-y-4">
              <p className="text-2xl md:text-4xl text-white font-bold tracking-wider">
                AI 驱动的智能小说创作平台
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <p className="text-base md:text-lg text-slate-300 italic font-serif">
                  在晨曦的第一缕光芒中，让灵感如墨般流淌
                </p>
                <div className="w-16 h-px bg-gradient-to-l from-transparent via-purple-500/50 to-transparent" />
              </div>
            </div>
          </div>

          {/* CTA Button with advanced effects */}
          <button
            onClick={onGetStarted}
            className="group relative px-12 py-5 text-xl font-bold rounded-2xl overflow-hidden transition-all duration-500 hover:scale-110 hover:shadow-2xl"
            style={{
              transform: `perspective(1000px) translateZ(${mousePos.y * 10}px)`,
              transition: 'transform 0.3s ease-out, scale 0.3s ease-out'
            }}
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 animate-gradient-x" />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Glow effect */}
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Button text */}
            <span className="relative flex items-center gap-3">
              开启创作之旅
              <span className="inline-flex items-center">
                <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-6 h-6 -ml-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </span>
          </button>

          {/* Scroll indicator - 优化箭头样式 */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-6 h-6 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7" />
              </svg>
              <svg className="w-6 h-6 text-purple-400/50 -mt-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Book Carousel Section */}
      <section
        className="relative py-32 px-4"
        style={{
          transform: `translateY(${scrollY * 0.2}px)`
        }}
      >
        {/* Background with parallax */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Section title with enhanced glassmorphism - 优化精选作品排版 */}
          <div className="text-center mb-20">
            <div className="inline-block backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-amber-500/30 rounded-3xl px-20 py-12 shadow-2xl relative overflow-hidden group hover:border-amber-500/50 transition-all duration-500">
              {/* 装饰性渐变边框 */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-purple-600/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* 四角装饰 */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-amber-500/50 rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-purple-500/50 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-purple-500/50 rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-amber-500/50 rounded-br-3xl" />

              {/* 顶部装饰线 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

              {/* 底部装饰线 */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

              <div className="relative space-y-6">
                <h2 className="text-5xl md:text-7xl font-serif font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent" style={{ fontFamily: "'Noto Serif SC', 'STKaiti', 'KaiTi', serif", letterSpacing: '0.1em' }}>
                  {userBooks.length > 0 ? '我的作品' : '精选作品'}
                </h2>

                <div className="flex items-center justify-center gap-4">
                  <div className="w-20 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                  <p className="text-lg md:text-xl text-slate-200 font-light tracking-wide">
                    {userBooks.length > 0 ? '继续你的创作之旅' : '开始你的第一部作品吧'}
                  </p>
                  <div className="w-2 h-2 rounded-full bg-purple-500/50" />
                  <div className="w-20 h-px bg-gradient-to-l from-transparent via-purple-500/70 to-transparent" />
                </div>
              </div>
            </div>
          </div>

          {/* 3D Book Carousel */}
          <BookCarousel
            books={displayBooks}
            onSelectBook={(book) => {
              if (userBooks.length > 0 && onSelectProject) {
                onSelectProject(book.id);
              } else {
                onGetStarted();
              }
            }}
          />
        </div>
      </section>

      {/* Features Section */}
      <section
        className="relative py-32 px-4"
        style={{
          transform: `translateY(${scrollY * 0.15}px)`
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: 'url(/bg-features.png)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              为什么选择晨曦遗墨？
            </h2>
            <p className="text-slate-300 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              专为网文作者打造的 AI 创作平台<br/>
              从世界观构建到章节创作，全流程智能辅助
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: '🎨',
                title: '智能世界构建',
                desc: 'AI 辅助构建完整的世界观、人物设定和情节框架',
                details: '• 自动生成角色关系网\n• 智能设定冲突检测\n• 剧情线索追踪管理',
                gradient: 'from-amber-500/20 to-orange-500/20'
              },
              {
                icon: '✨',
                title: '流畅创作体验',
                desc: '实时 AI 建议，智能续写，让创作过程更加顺畅',
                details: '• 多模型自由切换\n• 实时流式输出\n• 智能剧情建议',
                gradient: 'from-purple-500/20 to-pink-500/20'
              },
              {
                icon: '☁️',
                title: '云端同步',
                desc: '多设备无缝协作，随时随地继续你的创作',
                details: '• 腾讯云 CloudBase\n• 自动保存备份\n• 多端实时同步',
                gradient: 'from-blue-500/20 to-cyan-500/20'
              },
              {
                icon: '📖',
                title: '章节管理',
                desc: '清晰的章节结构，轻松管理长篇小说创作',
                details: '• 章节大纲视图\n• 字数统计分析\n• 创作进度追踪',
                gradient: 'from-emerald-500/20 to-teal-500/20'
              },
              {
                icon: '🎯',
                title: '智能校对',
                desc: 'AI 辅助校对，提升作品质量和可读性',
                details: '• 剧情连贯性检查\n• 人物设定一致性\n• 文风优化建议',
                gradient: 'from-amber-500/20 to-yellow-500/20'
              },
              {
                icon: '🌈',
                title: '封面生成',
                desc: 'AI 生成精美封面，让作品更加吸引人',
                details: '• 即梦 4.5 模型\n• 多风格可选\n• 高清输出',
                gradient: 'from-fuchsia-500/20 to-pink-500/20'
              },
              {
                icon: '🔥',
                title: '爽文模式',
                desc: '专为网文优化的创作模式，快节奏高产出',
                details: '• 快节奏剧情推进\n• 金手指设定辅助\n• 打脸爽点提示',
                gradient: 'from-red-500/20 to-orange-500/20'
              },
              {
                icon: '📊',
                title: '数据分析',
                desc: '创作数据可视化，了解你的创作习惯',
                details: '• 日均字数统计\n• 创作时间分析\n• 章节质量评分',
                gradient: 'from-indigo-500/20 to-purple-500/20'
              },
              {
                icon: '🎭',
                title: '多类型支持',
                desc: '支持玄幻、都市、仙侠等多种小说类型',
                details: '• 类型化模板\n• 风格化指导\n• 专业术语库',
                gradient: 'from-pink-500/20 to-rose-500/20'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:-translate-y-4 hover:shadow-2xl"
                style={{
                  transform: `perspective(1000px) rotateX(${mousePos.y * 2}deg) rotateY(${mousePos.x * 2}deg)`,
                  transition: 'transform 0.3s ease-out, background 0.5s, translate 0.5s'
                }}
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                <div className="relative">
                  <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-300 leading-relaxed mb-4 text-sm">{feature.desc}</p>

                  {/* 详细功能列表 */}
                  <div className="text-slate-400 text-xs space-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {feature.details.split('\n').map((detail, idx) => (
                      <p key={idx} className="leading-relaxed">{detail}</p>
                    ))}
                  </div>
                </div>

                {/* Shine effect */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - 修复遮挡问题 */}
<section
        className="relative py-40 px-4 z-20"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/bg-cta.png)', filter: 'brightness(0.5)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/50 to-slate-950" />

        <div className="relative z-30 max-w-5xl mx-auto text-center">
          <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-amber-500/30 rounded-3xl px-12 py-20 shadow-2xl">
            <h2 className="text-5xl md:text-6xl font-serif font-bold mb-8 bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent" style={{ fontFamily: "'Noto Serif SC', 'STKaiti', 'KaiTi', serif", letterSpacing: '0.1em' }}>
              准备好开始创作了吗？
            </h2>
            <p className="text-slate-200 mb-12 text-xl md:text-2xl leading-relaxed">
              加入晨曦遗墨，让 AI 成为你的创作伙伴
            </p>
            <button
              onClick={onGetStarted}
              className="group relative px-16 py-6 text-xl md:text-2xl font-bold rounded-2xl overflow-hidden transition-all duration-500 hover:scale-110 hover:shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 animate-gradient-x" />
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative flex items-center gap-3">
                立即开始
                <span className="inline-flex items-center">
                  <svg className="w-7 h-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                  <svg className="w-7 h-7 -ml-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 px-4 border-t border-white/10 z-20 bg-slate-950">
        <div className="absolute inset-0 backdrop-blur-xl bg-slate-950/95" />
        <div className="relative z-10 max-w-7xl mx-auto text-center text-slate-400 space-y-4">
          <p className="text-lg">© 2026 晨曦遗墨. All Rights Reserved.</p>
          <p className="text-slate-500 italic font-serif text-base">在晨曦的第一缕光芒中，让灵感如墨般流淌</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default PremiumHomePage;
