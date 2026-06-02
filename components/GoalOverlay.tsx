import React, { useEffect, useState } from 'react';
import { Team } from '../types';

interface GoalOverlayProps {
  teamName: string;
  teamLogo?: string;
  colorClass: string;
  onFinished: () => void;
}

const GoalOverlay: React.FC<GoalOverlayProps> = ({ teamName, teamLogo, colorClass, onFinished }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = setTimeout(() => {
      setActive(false);
      setTimeout(onFinished, 500); // Wait for fade out
    }, 3000);
    return () => clearTimeout(timer);
  }, [onFinished]);

  const bgColor = colorClass === 'blue' ? 'from-blue-600/90 to-blue-900/95' : 'from-red-600/90 to-red-900/95';
  const accentColor = colorClass === 'blue' ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 pointer-events-none ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${bgColor} backdrop-blur-sm`}></div>
      
      {/* Background patterns */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -inset-[10%] border-[20px] border-white/20 rounded-full animate-[ping_4s_linear_infinite]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-black italic select-none text-white/10 rotate-[-15deg]">GOAL</div>
      </div>

      <div className={`relative flex flex-col items-center justify-center text-center p-8 transition-transform duration-700 ${active ? 'scale-100 translate-y-0' : 'scale-50 translate-y-20'}`}>
        <div className="mb-6 flex items-center justify-center">
            {teamLogo ? (
                <img src={teamLogo} alt="" className="w-40 h-40 sm:w-64 sm:h-64 object-contain filter drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] animate-bounce" />
            ) : (
                <div className={`w-40 h-40 sm:w-64 sm:h-64 rounded-full border-8 border-white flex items-center justify-center text-6xl sm:text-8xl font-black italic bg-white ${accentColor}`}>
                    {teamName.charAt(0)}
                </div>
            )}
        </div>
        
        <h2 className="text-5xl sm:text-9xl font-black italic text-white uppercase tracking-tighter drop-shadow-2xl animate-pulse">
          GOAL!
        </h2>
        
        <div className="mt-4 px-8 py-2 bg-white text-black rounded-full font-black text-xl sm:text-4xl uppercase tracking-widest skew-x-[-10deg] shadow-2xl">
          {teamName}
        </div>
      </div>
    </div>
  );
};

export default GoalOverlay;