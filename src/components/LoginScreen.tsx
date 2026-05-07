import React from 'react';
import { LogIn } from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';

export default function LoginScreen() {
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

        <button
          onClick={() => loginWithGoogle()}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>

        <p className="text-xs text-slate-400">
          Ao entrar, você concorda com nossos termos de uso e política de privacidade.
        </p>
      </motion.div>
    </div>
  );
}
