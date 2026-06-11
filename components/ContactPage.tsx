import React, { useState } from 'react';

interface ContactPageProps {
  onClose: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await response.json();
      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Could not send message. Please email us directly at hello@topcheesehockey.com');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Contact Us</h2>
          <p className="text-xs text-slate-500 mt-0.5">We typically respond within 24 hours</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
        >×</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-xl mx-auto w-full">
        {sent ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className="text-5xl">🏒</div>
            <h3 className="text-2xl font-black text-white">Message sent!</h3>
            <p className="text-slate-400">Thanks {name}! We'll get back to you at {email} within 24 hours.</p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors"
            >
              Back to App
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-4">
              <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-24 w-auto mb-2" />
            </div>
            <p className="text-slate-400 text-sm">Have a question, feedback, or need support? Send us a message and we'll get back to you as soon as possible.</p>

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="How can we help you?"
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={sending}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${sending ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                </span>
              ) : 'Send Message →'}
            </button>

            <p className="text-slate-600 text-xs text-center">
              Or email us directly at{' '}
              <a href="mailto:hello@topcheesehockey.com" className="text-cyan-400 hover:text-cyan-300">
                hello@topcheesehockey.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactPage;
