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
    if (!name.trim() || !email.trim() || !message.trim()) { setError('Please fill in all fields.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await response.json();
      if (data.success) setSent(true);
      else setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not send message. Please email us directly at hello@topcheesehockey.com');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-[#05070a] flex flex-col">

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
      >×</button>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
          <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-28 w-auto mb-4" />
          <h3 className="text-3xl font-black text-white">Message sent!</h3>
          <p className="text-slate-400">Thanks {name}! We'll get back to you at {email} within 24 hours.</p>
          <button onClick={onClose} className="mt-4 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors">Back to App</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

          {/* LEFT — Logo + branding */}
          <div className="lg:w-1/2 flex flex-col items-center justify-center bg-[#0a0e14] border-r border-white/5 px-10 py-12 gap-6">
            <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="w-64 sm:w-80 lg:w-96 max-w-full" />
            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Get in Touch</h2>
              <p className="text-slate-400 text-base max-w-xs">Have a question, feedback, or need support? We'd love to hear from you.</p>
            </div>
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-slate-600 text-sm">Or reach us directly</p>
              <a href="mailto:hello@topcheesehockey.com" className="text-cyan-400 hover:text-cyan-300 font-bold text-sm transition-colors">
                hello@topcheesehockey.com
              </a>
            </div>
          </div>

          {/* RIGHT — Form */}
          <div className="lg:w-1/2 flex flex-col justify-center overflow-y-auto px-8 sm:px-12 py-10">
            <h3 className="text-xl font-black text-white mb-6">Send us a message</h3>

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Your Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help you?" rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/40 transition-colors resize-none" />
              </div>
              <button onClick={handleSubmit} disabled={sending}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${sending ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg'}`}>
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                  </span>
                ) : 'Send Message →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactPage;
