import React, { useEffect, useRef } from 'react';

interface Book {
  id: string;
  title: string;
  cover: string;
  author: string;
  chapters: number;
}

interface SimpleCarouselProps {
  books: Book[];
  onSelectBook?: (book: Book) => void;
}

const SimpleCarousel: React.FC<SimpleCarouselProps> = ({ books, onSelectBook }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || books.length === 0) return;

    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      if (!scrollContainer) return;

      scrollPosition += scrollSpeed;

      // Reset scroll when reaching the end
      if (scrollPosition >= scrollContainer.scrollWidth / 2) {
        scrollPosition = 0;
      }

      scrollContainer.scrollLeft = scrollPosition;
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [books.length]);

  if (books.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500">
        <p>暂无作品</p>
      </div>
    );
  }

  // Duplicate books for infinite scroll effect
  const displayBooks = [...books, ...books];

  return (
    <div className="relative w-full py-12 overflow-hidden">
      {/* Gradient Overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-pink-50 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-pink-50 to-transparent z-10 pointer-events-none" />

      {/* Scrolling Container */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {displayBooks.map((book, index) => (
          <div
            key={`${book.id}-${index}`}
            onClick={() => onSelectBook?.(book)}
            className="group relative flex-shrink-0 w-48 cursor-pointer transition-all duration-300 hover:scale-105"
          >
            {/* Book Cover */}
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/50 group-hover:ring-4 group-hover:ring-purple-300/50 transition-all">
              <img
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <p className="text-sm font-bold line-clamp-2">{book.title}</p>
                  <p className="text-xs text-white/80 mt-1">{book.author}</p>
                </div>
              </div>
            </div>

            {/* Book Info */}
            <div className="mt-3 text-center">
              <h3 className="text-sm font-bold text-slate-800 line-clamp-1">
                {book.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {book.chapters} 章
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pause on Hover Hint */}
      <div className="text-center mt-6">
        <p className="text-xs text-slate-400">
          悬停查看详情 · 自动滚动展示
        </p>
      </div>
    </div>
  );
};

export default SimpleCarousel;
