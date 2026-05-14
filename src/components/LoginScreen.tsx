import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { signInWithMagicLink } from '../lib/supabase';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      await signInWithMagicLink(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full bg-white rounded-3xl p-8 shadow-xl text-center space-y-8"
      >
        <div className="space-y-2">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
          <h1 className="text-3xl font-bold text-slate-900">BioEvolve</h1>
          <p className="text-slate-500">Sua inteligência de saúde em um só lugar.</p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 py-8"
          >
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900">E-mail enviado!</h3>
              <p className="text-sm text-slate-500 text-balance">
                Enviamos um link de acesso para <strong>{email}</strong>. Verifique sua caixa de entrada.
              </p>
            </div>
            <button 
              onClick={() => setSuccess(false)}
              className="text-sm text-indigo-600 font-medium hover:underline"
            >
              Tentar outro e-mail
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            
            {error && <p className="text-xs text-rose-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 py-4 rounded-2xl font-bold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Receber link de acesso"
              )}
            </button>
          </form>
        )}

        <p className="text-xs text-slate-400">
          Ao entrar, você concorda com nossos termos de uso e política de privacidade.
        </p>
      </motion.div>
    </div>
  );
}
