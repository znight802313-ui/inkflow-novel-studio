import React, { useState, useEffect } from 'react';

interface Book {
  id: string;
  title: string;
  cover: string;
  author: string;
  chapters: number;
}

interface BookCarouselProps {
  books: Book[];
  onSelectBook?: (book: Book) => void;
}

const BookCarousel: React.FC<BookCarouselProps> = ({ books, onSelectBook }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Auto-rotate carousel - 加快速度
  useEffect(() => {
    if (!isAutoRotating || books.length === 0) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % books.length);
    }, 1500); // 从 3000ms 改为 1500ms，速度快一倍

    return () => clearInterval(interval);
  }, [isAutoRotating, books.length]);

  const handlePrev = () => {
    setIsAutoRotating(false);
    setActiveIndex((prev) => (prev - 1 + books.length) % books.length);
  };

  const handleNext = () => {
    setIsAutoRotating(false);
    setActiveIndex((prev) => (prev + 1) % books.length);
  };

  const getItemStyle = (index: number) => {
    const diff = index - activeIndex;
    const totalBooks = books.length;

    // Normalize diff to be between -totalBooks/2 and totalBooks/2
    let normalizedDiff = diff;
    if (Math.abs(diff) > totalBooks / 2) {
      normalizedDiff = diff > 0 ? diff - totalBooks : diff + totalBooks;
    }

    const isActive = normalizedDiff === 0;
    const absPos = Math.abs(normalizedDiff);

    // Calculate position and scale
    const angle = normalizedDiff * 25; // degrees
    const translateX = normalizedDiff * 280; // px
    const translateZ = isActive ? 100 : -absPos * 150; // px
    const scale = isActive ? 1.2 : Math.max(0.6, 1 - absPos * 0.2);
    const opacity = isActive ? 1 : Math.max(0.3, 1 - absPos * 0.3);

    return {
      transform: `
        translateX(${translateX}px)
        translateZ(${translateZ}px)
        rotateY(${angle}deg)
        scale(${scale})
      `,
      opacity,
      zIndex: isActive ? 10 : Math.max(0, 5 - absPos),
      transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  };

  if (books.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500">
        <p>暂无作品</p>
      </div>
    );
  }

  return (
    <div className="relative w-full py-20">
      {/* 3D Perspective Container */}
      <div
        className="relative h-96 flex items-center justify-center"
        style={{ perspective: '1500px' }}
        onMouseEnter={() => setIsAutoRotating(false)}
        onMouseLeave={() => setIsAutoRotating(true)}
      >
        {/* Books */}
        {books.map((book, index) => {
          const style = getItemStyle(index);
          const isActive = index === activeIndex;

          return (
            <div
              key={book.id}
              className="absolute cursor-pointer"
              style={{
                ...style,
                transformStyle: 'preserve-3d'
              }}
              onClick={() => {
                setActiveIndex(index);
                setIsAutoRotating(false);
                onSelectBook?.(book);
              }}
            >
              {/* Book Card - 纯封面展示 */}
              <div className={`
                relative w-56 h-80 rounded-2xl overflow-hidden
                shadow-2xl
                ${isActive ? 'ring-4 ring-purple-500/50' : ''}
                transition-all duration-300
                hover:scale-105
              `}>
                {/* Cover Image */}
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100">
                    📖
                  </div>
                )}

                {/* Glow Effect */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 pointer-events-none" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-4 pointer-events-none">
        <button
          onClick={handlePrev}
          className="pointer-events-auto w-12 h-12 rounded-full backdrop-blur-xl bg-white/80 border border-white/50 text-slate-600 hover:text-purple-600 hover:border-purple-500/50 transition-all shadow-lg hover:scale-110"
        >
          <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={handleNext}
          className="pointer-events-auto w-12 h-12 rounded-full backdrop-blur-xl bg-white/80 border border-white/50 text-slate-600 hover:text-purple-600 hover:border-purple-500/50 transition-all shadow-lg hover:scale-110"
        >
          <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {books.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setActiveIndex(index);
              setIsAutoRotating(false);
            }}
            className={`
              h-2 rounded-full transition-all duration-300
              ${index === activeIndex
                ? 'w-8 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500'
                : 'w-2 bg-slate-300 hover:bg-slate-400'
              }
            `}
          />
        ))}
      </div>

      {/* Auto-rotate Toggle */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2"
        >
          {isAutoRotating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              自动轮播中
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              已暂停
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BookCarousel;
