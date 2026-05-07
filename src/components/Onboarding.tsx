import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowRight, User } from 'lucide-react';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

export default function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Save initial profile data
      await setDoc(doc(db, `users/${userId}/profile/initial`), {
        age: parseInt(age),
        weight: parseFloat(weight),
        onboardingComplete: true,
        createdAt: serverTimestamp()
      });
      
      // Initialize main user document
      await setDoc(doc(db, `users/${userId}`), {
        bioScore: 0,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      onComplete();
    } catch (error) {
      console.error("Error saving onboarding:", error);
      alert("Erro ao salvar perfil. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6 text-white text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full space-y-8"
      >
        <div className="space-y-4">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full mx-auto flex items-center justify-center">
            <User size={40} />
          </div>
          <h2 className="text-2xl font-bold">Personalize sua experiência</h2>
          <p className="text-indigo-100">Precisamos de alguns dados básicos para calcular seu BioScore com precisão.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="number"
            placeholder="Sua idade"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white placeholder-indigo-200 outline-none focus:bg-white/20 transition-all"
            required
          />
          <input
            type="number"
            step="0.1"
            placeholder="Seu peso (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white placeholder-indigo-200 outline-none focus:bg-white/20 transition-all"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Começar Agora'}
            <ArrowRight size={20} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
