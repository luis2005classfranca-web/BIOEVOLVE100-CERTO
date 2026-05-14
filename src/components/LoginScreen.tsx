import React, { useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { loginAnonymously, loginWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, do nothing
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Domínio não autorizado. Adicione este domínio no Firebase Console > Authentication > Settings.");
      } else {
        setError(err.message || "Erro ao fazer login com Google.");
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginAnonymously();
    } catch (err: any) {
      if (err.message?.includes('Anonymous sign-ins are disabled')) {
        setError("O login anônimo está desativado no Firebase. Ative-o no console.");
      } else {
        setError(err.message || "Erro ao acessar o app. Tente novamente.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full bg-white rounded-3xl p-10 shadow-xl text-center space-y-8"
      >
        <div className="space-y-2">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <User size={32} />
            </div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">BioEvolve</h1>
          <p className="text-slate-500">Sua inteligência de saúde em um só lugar.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loadingGoogle ? (
              <Loader2 className="animate-spin text-slate-400" size={24} />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.6 26.9 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.5 39.6 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
                </svg>
                Entrar com Google
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">ou</span>
            </div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading || loadingGoogle}
            className="text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors py-2"
          >
            {loading ? "Entrando..." : "Continuar sem conta →"}
          </button>
          
          {error && <p className="text-xs text-rose-500 bg-rose-50 p-3 rounded-lg">{error}</p>}
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed max-w-[240px] mx-auto">
          Ao entrar, você concorda com nossos termos. Dados anônimos podem ser perdidos ao limpar o cache do navegador.
        </p>
      </motion.div>
    </div>
  );
}

