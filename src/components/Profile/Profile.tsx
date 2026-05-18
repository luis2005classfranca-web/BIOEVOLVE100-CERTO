import React from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, Heart, History, X, ChevronRight } from 'lucide-react';

interface ProfileProps {
    user: any;
    logout: () => void;
}

export default function Profile({ user, logout }: ProfileProps) {
    return (
        <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex flex-col items-center space-y-4">
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border-4 border-white shadow-lg overflow-hidden">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'Usuário'} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-3xl font-bold uppercase">{user?.email?.[0] || user?.uid?.[0] || <UserIcon size={48} />}</span>
                    )}
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800">{user?.displayName || 'Usuário Anônimo'}</h2>
                    {user?.email && <p className="text-sm text-slate-500">{user.email}</p>}
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center gap-4 hover:bg-slate-50 cursor-pointer">
                    <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><Heart size={20} /></div>
                    <div className="flex-1"><p className="text-sm font-bold">Conectar Health Connect</p></div>
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
                <div className="p-4 border-b border-slate-50 flex items-center gap-4 hover:bg-slate-50 cursor-pointer">
                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><History size={20} /></div>
                    <div className="flex-1"><p className="text-sm font-bold">Histórico de Check-ups</p></div>
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
                <div
                    onClick={logout}
                    className="p-4 flex items-center gap-4 hover:bg-rose-50 cursor-pointer text-rose-600"
                >
                    <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><X size={20} /></div>
                    <div className="flex-1"><p className="text-sm font-bold">Sair da Conta</p></div>
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
            </div>
        </motion.div>
    );
}
