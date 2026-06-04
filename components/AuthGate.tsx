import React from 'react';
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';

interface AuthGateProps {
  onAuthenticated: () => void;
}

const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');

  // When Clerk detects signed in state, move forward
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      onAuthenticated();
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
        <div className="flex gap-2">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center px-4 py-12">
      <img src="/Top_Cheese_Hockey_logo.png" alt="Top Cheese Hockey" className="h-28 w-auto mb-8" />
      
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 w-full max-w-sm">
        <button
          onClick={() => setMode('signin')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'signin' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >Sign In</button>
        <button
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'signup' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >Create Account</button>
      </div>

      <div className="w-full max-w-sm">
        {mode === 'signin' ? (
          <SignIn
            routing="hash"
            forceRedirectUrl={window.location.href}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-[#0f1620] border border-white/10 shadow-2xl rounded-2xl w-full',
                headerTitle: 'text-white font-black',
                headerSubtitle: 'text-slate-400',
                formFieldLabel: 'text-slate-300 text-sm',
                formFieldInput: 'bg-black/40 border-white/10 text-white rounded-xl',
                formButtonPrimary: 'bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold',
                footerActionLink: 'text-cyan-400 hover:text-cyan-300',
                identityPreviewText: 'text-slate-300',
                identityPreviewEditButton: 'text-cyan-400',
              }
            }}
          />
        ) : (
          <SignUp
            routing="hash"
            forceRedirectUrl={window.location.href}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-[#0f1620] border border-white/10 shadow-2xl rounded-2xl w-full',
                headerTitle: 'text-white font-black',
                headerSubtitle: 'text-slate-400',
                formFieldLabel: 'text-slate-300 text-sm',
                formFieldInput: 'bg-black/40 border-white/10 text-white rounded-xl',
                formButtonPrimary: 'bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold',
                footerActionLink: 'text-cyan-400 hover:text-cyan-300',
              }
            }}
          />
        )}
      </div>

      <p className="text-slate-600 text-xs mt-6">
        © 2026 Top Cheese Hockey · Built for hockey people, by hockey people
      </p>
    </div>
  );
};

export default AuthGate;
