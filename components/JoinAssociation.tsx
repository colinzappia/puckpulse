// ============================================================
// JoinAssociation.tsx
// A coach enters their association's join code plus the team
// they represent to activate their own access — self-service,
// so one association admin isn't stuck manually inviting every
// individual coach by email.
// ============================================================

import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';

interface Props {
  onClose: () => void;
  onJoined: () => void;
}

export default function JoinAssociation({ onClose, onJoined }: Props) {
  const { user } = useUser();
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ associationName: string; overLimit: boolean } | null>(null);
  const [error, setError] = useState('');

  const email = user?.primaryEmailAddress?.emailAddress;

  const handleJoin = async () => {
    if (!email) return;
    if (!joinCode.trim() || !teamName.trim()) {
      setError('Enter both your join code and your team name.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/join-association', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.trim(), email, teamName: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join that association.');
      setResult({ associationName: data.associationName, overLimit: data.overLimit });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-sm w-full bg-[#0f1620] border border-white/10 rounded-3xl p-8" onClick={e => e.stopPropagation()}>
        {!result ? (
          <>
            <div className="text-white font-black text-lg uppercase tracking-widest mb-1">Join Your Association</div>
            <div className="text-slate-500 text-xs mb-6">Enter the code your association admin shared with you.</div>

            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Join code</div>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7M2P9QX"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-black tracking-[0.2em] text-center outline-none focus:border-emerald-500/50 mb-4"
              maxLength={8}
            />

            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Your team</div>
            <input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. U15 AAA Storm"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50 mb-4"
            />

            {error && (
              <div className="text-red-400 text-xs mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>
            )}

            <button
              onClick={handleJoin}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-sm disabled:opacity-40 mb-2"
            >
              {submitting ? 'Joining…' : 'Join Association'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-slate-500 text-xs uppercase tracking-widest">
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4 text-center">✅</div>
            <div className="text-white font-black text-lg uppercase tracking-widest mb-2 text-center">You're In</div>
            <div className="text-slate-400 text-sm text-center mb-6">
              You now have access through <span className="text-white font-bold">{result.associationName}</span>.
            </div>
            {result.overLimit && (
              <div className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 leading-relaxed">
                Heads up — this association currently has more teams registered than its plan covers. Access still
                works fine for now; your association admin may want to check whether it's time to upgrade.
              </div>
            )}
            <button
              onClick={onJoined}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-sm"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
