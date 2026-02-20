import React from 'react';
import WelcomeHero from './WelcomeHero';
import BookCarousel from './BookCarousel';

interface HomePageProps {
  onGetStarted: () => void;
  projects?: Array<{
    _id: string;
    title: string;
    coverImage?: string;
    chapterCount?: number;
  }>;
  onSelectProject?: (projectId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onGetStarted, projects = [], onSelectProject }) => {
  // Demo books for carousel - 使用用户提供的 11 张封面
  const demoBooks = [
    {
      id: 'demo1',
      title: '星辰之海',
      cover: '/book1.jpg',
      author: '晨曦遗墨',
      chapters: 24
    },
    {
      id: 'demo2',
      title: '时光旅人',
      cover: '/book2.jpg',
      author: '晨曦遗墨',
      chapters: 18
    },
    {
      id: 'demo3',
      title: '魔法学院',
      cover: '/book3.jpg',
      author: '晨曦遗墨',
      chapters: 32
    },
    {
      id: 'demo4',
      title: '都市传说',
      cover: '/book4.jpg',
      author: '晨曦遗墨',
      chapters: 15
    },
    {
      id: 'demo5',
      title: '异世界冒险',
      cover: '/book5.jpg',
      author: '晨曦遗墨',
      chapters: 28
    },
    {
      id: 'demo6',
      title: '青春物语',
      cover: '/book6.jpg',
      author: '晨曦遗墨',
      chapters: 20
    },
    {
      id: 'demo7',
      title: '末日余晖',
      cover: '/book7.jpg',
      author: '晨曦遗墨',
      chapters: 36
    },
    {
      id: 'demo8',
      title: '仙侠传奇',
      cover: '/book8.jpg',
      author: '晨曦遗墨',
      chapters: 42
    },
    {
      id: 'demo9',
      title: '悬疑档案',
      cover: '/book9.jpg',
      author: '晨曦遗墨',
      chapters: 16
    },
    {
      id: 'demo10',
      title: '科幻纪元',
      cover: '/book10.jpg',
      author: '晨曦遗墨',
      chapters: 30
    },
    {
      id: 'demo11',
      title: '奇幻之旅',
      cover: '/book11.jpg',
      author: '晨曦遗墨',
      chapters: 25
    }
  ];

  // Convert projects to book format
  const userBooks = projects.map(p => ({
    id: p._id,
    title: p.title,
    cover: p.coverImage || '/cover1.png',
    author: '我的作品',
    chapters: p.chapterCount || 0
  }));

  const displayBooks = userBooks.length > 0 ? userBooks : demoBooks;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Welcome Hero Section */}
      <WelcomeHero onGetStarted={onGetStarted} />

      {/* Book Carousel Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              {userBooks.length > 0 ? '我的作品' : '精选作品'}
            </h2>
            <p className="text-slate-600">
              {userBooks.length > 0
                ? '继续你的创作之旅'
                : '开始你的第一部作品吧'}
            </p>
          </div>

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
      <section className="py-20 px-4 bg-white/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-slate-800">
              为什么选择晨曦遗墨？
            </h2>
            <p className="text-slate-600">
              AI 驱动的智能创作平台，让灵感自由流淌
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🎨',
                title: '智能世界构建',
                desc: 'AI 辅助构建完整的世界观、人物设定和情节框架',
                color: 'from-pink-400 to-rose-400'
              },
              {
                icon: '✨',
                title: '流畅创作体验',
                desc: '实时 AI 建议，智能续写，让创作过程更加顺畅',
                color: 'from-purple-400 to-indigo-400'
              },
              {
                icon: '☁️',
                title: '云端同步',
                desc: '多设备无缝协作，随时随地继续你的创作',
                color: 'from-blue-400 to-cyan-400'
              },
              {
                icon: '📖',
                title: '章节管理',
                desc: '清晰的章节结构，轻松管理长篇小说创作',
                color: 'from-emerald-400 to-teal-400'
              },
              {
                icon: '🎯',
                title: '智能校对',
                desc: 'AI 辅助校对，提升作品质量和可读性',
                color: 'from-amber-400 to-orange-400'
              },
              {
                icon: '🌈',
                title: '封面生成',
                desc: 'AI 生成精美封面，让作品更加吸引人',
                color: 'from-fuchsia-400 to-pink-400'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative backdrop-blur-xl bg-white/60 border border-white/50 rounded-3xl p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                {/* Gradient Border on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity`} />

                <div className="relative">
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            准备好开始创作了吗？
          </h2>
          <p className="text-slate-600 mb-8 text-lg">
            加入晨曦遗墨，让 AI 成为你的创作伙伴
          </p>
          <button
            onClick={onGetStarted}
            className="group relative px-10 py-4 text-lg font-bold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-50 group-hover:opacity-75 transition-opacity" />
            <span className="relative flex items-center gap-2">
              立即开始
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-pink-200/50 bg-white/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto text-center text-sm text-slate-500">
          <p>© 2026 晨曦遗墨. All Rights Reserved.</p>
          <p className="mt-2">在晨曦的第一缕光芒中，让灵感如墨般流淌</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
