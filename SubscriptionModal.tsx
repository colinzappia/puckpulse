
import React from 'react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onSubscribe }) => {
  if (!isOpen) return null;

  const plans = [
    {
      name: 'Rookie',
      price: '$0',
      period: 'Forever',
      description: 'Basic game tracking for amateur coaches.',
      features: ['Manual Event Logging', 'Rink Mapping', 'Period Summaries', '2 Team Slots'],
      button: 'Current Plan',
      active: false,
      color: 'gray'
    },
    {
      name: 'Pro',
      price: '$9.99',
      period: 'per month',
      description: 'Advanced AI analysis for broadcasters.',
      features: ['AI Smart Roster Sync', 'Live AI Ice Insights', 'Full Post-Game Narratives', 'Custom Team Logos'],
      button: 'Start Pro Trial',
      active: true,
      color: 'blue'
    },
    {
      name: 'Elite',
      price: '$89',
      period: 'per year',
      description: 'The ultimate tool for professional leagues.',
      features: ['Everything in Pro', 'Power Play Analysis', 'CSV Data Exports', 'Priority AI Processing'],
      button: 'Go Elite',
      active: false,
      color: 'orange'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-5xl w-full animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-5xl font-black text-white italic uppercase tracking-tighter mb-2">Rule The Crease</h2>
          <p className="text-blue-500 font-bold uppercase tracking-[0.3em] text-[10px] sm:text-xs">Unlock Top Cheese Hockey Pro Features</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`relative bg-slate-900/50 border ${plan.active ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.2)] scale-105 z-10' : 'border-white/10'} rounded-[2.5rem] p-8 flex flex-col transition-all`}
            >
              {plan.active && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                  League Standard
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-slate-500 text-xs font-bold uppercase">{plan.period}</span>
                </div>
                <p className="mt-4 text-slate-400 text-xs leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-[11px] font-semibold text-slate-300">
                    <svg className={`w-4 h-4 shrink-0 ${plan.active ? 'text-blue-500' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => plan.price !== '$0' && onSubscribe()}
                disabled={plan.price === '$0'}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                  plan.active 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500' 
                  : plan.price === '$0' ? 'bg-slate-800 text-slate-500 cursor-default' : 'bg-white text-black hover:bg-slate-200'
                }`}
              >
                {plan.button}
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="mt-10 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors block mx-auto"
        >
          Maybe After the Intermission
        </button>
      </div>
    </div>
  );
};

export default SubscriptionModal;
