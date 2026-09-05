import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hey! I'm the Top Cheese Hockey support assistant. Ask me anything about how the app works, pricing, or setup — and if I can't help, I'll point you to a real person.",
};

// Floating chat widget for the public marketing site only — deliberately
// not shown inside the live game-tracking app itself. A coach mid-game
// needs the rink and the User Manual, not a chat window competing for
// screen space; this is for pre-purchase questions and general
// troubleshooting on the website.
const SupportChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setError('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);
    try {
      const response = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Skip the canned greeting when sending history — it was never
        // actually said by the model, just shown as a UI starter message.
        body: JSON.stringify({ messages: nextMessages.filter((m, i) => !(i === 0 && m === GREETING)) }),
      });
      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setError(data.error || 'Something went wrong. Please email hello@topcheesehockey.com instead.');
      }
    } catch {
      setError('Could not reach support chat. Please email hello@topcheesehockey.com instead.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-5 right-5 z-[500] w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-2xl flex items-center justify-center text-2xl transition-all active:scale-90"
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-5 z-[500] w-[90vw] max-w-sm h-[70vh] max-h-[560px] bg-[#0f1620] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <span className="text-lg">🏒</span>
            <div>
              <p className="text-white font-black text-sm leading-tight">Top Cheese Hockey Support</p>
              <p className="text-slate-500 text-[10px] leading-tight">Usually replies instantly</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${m.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-slate-200 border border-white/10'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-red-300 text-[12px]">{error}</div>
            )}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask a question..."
              disabled={isSending}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/5 disabled:text-slate-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
