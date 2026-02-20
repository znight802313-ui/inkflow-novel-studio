import React, { useEffect, useRef } from 'react';

interface WelcomeHeroProps {
  onGetStarted: () => void;
}

const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onGetStarted }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle animation effect
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
    }> = [];

    // Create particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle with gradient - 小清新配色
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 2
        );
        gradient.addColorStop(0, `rgba(251, 113, 133, ${particle.opacity})`); // Pink
        gradient.addColorStop(0.5, `rgba(167, 139, 250, ${particle.opacity * 0.5})`); // Purple
        gradient.addColorStop(1, 'rgba(147, 197, 253, 0)'); // Blue

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections
        particles.forEach((otherParticle, j) => {
          if (i === j) return;
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.strokeStyle = `rgba(167, 139, 250, ${(1 - distance / 150) * 0.15})`; // Purple connections
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Particle Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-30"
      />

      {/* Gradient Orbs - 小清新配色 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-300/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative w-32 h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/50">
              <img src="/logo.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-8xl font-bold mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            晨曦遗墨
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-slate-600 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          AI 驱动的小说创作平台
        </p>

        <p className="text-sm md:text-base text-slate-500 mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
          在晨曦的第一缕光芒中，让灵感如墨般流淌。<br />
          智能辅助创作，传承文学之美。
        </p>

        {/* CTA Button */}
        <button
          onClick={onGetStarted}
          className="group relative px-8 py-4 text-lg font-bold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 shadow-2xl"
        >
          {/* Button Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
          <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Button Glow */}
          <div className="absolute inset-0 blur-xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-50 group-hover:opacity-75 transition-opacity" />

          {/* Button Text */}
          <span className="relative flex items-center gap-2">
            开始创作
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
          {[
            { icon: '🌍', title: '世界构建', desc: 'AI 辅助构建完整世界观', color: 'from-pink-400 to-rose-400' },
            { icon: '✍️', title: '智能创作', desc: '流畅的章节生成体验', color: 'from-purple-400 to-indigo-400' },
            { icon: '☁️', title: '云端同步', desc: '多设备无缝协作', color: 'from-blue-400 to-cyan-400' }
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative backdrop-blur-xl bg-white/60 border border-white/50 rounded-3xl p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
            >
              {/* Card Glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity`} />

              <div className="relative">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </div>
  );
};

export default WelcomeHero;
