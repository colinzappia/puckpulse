// ============================================================
// AssociationWelcome.tsx
// Landed on right after a successful Association season-pass
// purchase. The webhook that actually creates the association
// record runs independently of this page loading, so there's a
// real (usually brief) window where it hasn't finished yet —
// this polls a few times before giving up, rather than showing
// a false failure the instant the page loads.
// ============================================================

import React, { useEffect, useState } from 'react';

interface AssociationInfo {
  association_name: string;
  join_code: string;
  teams_allowed: number;
  season_start: string;
  season_end: string;
}

interface Props {
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function AssociationWelcome({ onClose }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [association, setAssociation] = useState<AssociationInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setStatus('failed');
      return;
    }

    let attempts = 0;
    const maxAttempts = 6;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch('/api/get-association-by-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (data.status === 'ready') {
          setAssociation(data.association);
          setStatus('ready');
          return;
        }
        if (data.status === 'not_paid') {
          setStatus('failed');
          return;
        }
      } catch {
        // fall through to retry
      }
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        setStatus('failed');
      }
    };

    poll();
  }, []);

  const copyCode = () => {
    if (!association) return;
    navigator.clipboard.writeText(association.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0f1620] border border-white/10 rounded-3xl p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4 animate-pulse">🏒</div>
            <div className="text-white font-black text-lg uppercase tracking-widest mb-2">Setting up your association…</div>
            <div className="text-slate-500 text-sm">This usually takes just a few seconds.</div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-white font-black text-lg uppercase tracking-widest mb-2">Almost there</div>
            <div className="text-slate-400 text-sm leading-relaxed mb-6">
              Your payment went through, but we're having trouble pulling up your association's details right now.
              Contact support with your email and we'll get your join code to you directly — nothing's wrong with your payment.
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-sm">
              Back to Top Cheese Hockey
            </button>
          </>
        )}

        {status === 'ready' && association && (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <div className="text-white font-black text-xl uppercase tracking-widest mb-1">{association.association_name}</div>
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-6">
              {formatDate(association.season_start)} – {formatDate(association.season_end)} · Up to {association.teams_allowed} teams
            </div>

            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Your join code</div>
            <div
              onClick={copyCode}
              className="text-3xl font-black text-emerald-400 tracking-[0.3em] bg-black/40 border border-emerald-500/30 rounded-2xl py-4 mb-2 cursor-pointer select-all"
            >
              {association.join_code}
            </div>
            <div className="text-slate-500 text-[11px] mb-6">{copied ? '✓ Copied to clipboard' : 'Tap the code to copy it'}</div>

            <div className="text-slate-400 text-sm leading-relaxed mb-6 text-left bg-white/5 rounded-2xl p-4">
              Share this code with every coach in your association. Each one enters it themselves, along with which
              team they coach, to activate their own access — no need to invite everyone individually.
            </div>

            <button onClick={onClose} className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-sm">
              Get Started
            </button>
          </>
        )}
      </div>
    </div>
  );
}
