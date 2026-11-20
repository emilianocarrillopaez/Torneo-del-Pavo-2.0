import React from 'react';

interface TopRibbonProps {
  clubName?: string;
}

export const TopRibbon: React.FC<TopRibbonProps> = ({
  clubName = 'CLUB DE AJEDREZ DON GONZALO',
}) => {
  return (
    <div className="relative w-full flex justify-center items-center py-2 z-20 overflow-hidden">
      {/* Decorative Ribbon Container */}
      <div className="relative inline-flex items-center justify-center">
        {/* Left folded ribbon end */}
        <div className="hidden sm:block absolute -left-7 top-1/2 -translate-y-1/2 w-8 h-9 bg-red-900 clip-ribbon-left shadow-md transform -skew-y-3" />
        
        {/* Center main ribbon banner */}
        <div className="relative bg-gradient-to-r from-red-800 via-red-600 to-red-800 text-yellow-300 px-6 sm:px-12 py-1.5 sm:py-2 rounded-sm border-y-2 border-yellow-400 shadow-xl flex items-center gap-2">
          {/* Subtle gold chess pieces at corners */}
          <span className="text-yellow-300 text-base sm:text-lg">♟</span>
          
          <h2 className="font-festive font-black tracking-wider text-sm sm:text-lg md:text-xl text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] uppercase text-center">
            {clubName}
          </h2>
          
          <span className="text-yellow-300 text-base sm:text-lg">♟</span>
        </div>

        {/* Right folded ribbon end */}
        <div className="hidden sm:block absolute -right-7 top-1/2 -translate-y-1/2 w-8 h-9 bg-red-900 clip-ribbon-right shadow-md transform skew-y-3" />
      </div>
    </div>
  );
};
