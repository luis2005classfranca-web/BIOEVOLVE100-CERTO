import React, { useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { loginAnonymously } from '../lib/supabase';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginAnonymously();
    } catch (err: any) {
      if (err.message?.includes('Anonymous sign-ins are disabled')) {
        setError("O login anônimo está desativado no Supabase. Ative-o em: Authentication > Providers > Anonymous.");
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
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 py-5 rounded-2xl font-bold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              "Acessar Aplicativo"
            )}
          </button>
          
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <p className="text-xs text-slate-400">
          Uso rápido e anônimo. Seus dados serão mantidos enquanto seu navegador estiver ativo.
        </p>
      </motion.div>
    </div>
  );
}

