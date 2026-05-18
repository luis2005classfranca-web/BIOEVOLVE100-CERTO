import React from 'react';
import { motion } from 'motion/react';
import { Heart, Zap, History, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { ExamRecord, WearableData, HealthInsight } from '../../types';
import { Skeleton, CardSkeleton } from '../Skeleton';

interface DashboardProps {
    currentBioScore: number;
    latestWearable: WearableData | null;
    wearableData: WearableData[];
    insight: HealthInsight | null;
    insightsHistory: HealthInsight[];
    isDataLoaded: { wearables: boolean, insights: boolean };
    isGeneratingInsight: boolean;
    generateInsight: () => void;
}

export default function Dashboard({
    currentBioScore,
    latestWearable,
    wearableData,
    insight,
    insightsHistory,
    isDataLoaded,
    isGeneratingInsight,
    generateInsight
}: DashboardProps) {
    return (
        <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-8"
        >
            <div className="lg:col-span-12 mb-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    Olá! Bem-vindo de volta 👋
                </h1>
                <p className="text-slate-500 text-sm">Resumo da sua saúde para hoje.</p>
            </div>

            <div className="lg:col-span-7 space-y-6">
                {/* BioScore Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Seu BioScore Atual</p>
                                <h2 className="text-6xl font-black mt-2">{currentBioScore}</h2>
                            </div>
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                                <TrendingUp size={28} />
                            </div>
                        </div>
                        <p className="mt-6 text-sm md:text-base text-indigo-100/90 leading-relaxed max-w-md">
                            {currentBioScore > 0
                                ? "Seu score está sendo calculado com base nas suas últimas tendências de exames e atividade física capturadas."
                                : "Adicione seus primeiros exames para que nossa IA comece a mapear sua evolução biológica."
                            }
                        </p>
                    </div>
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-[80px]" />
                    <div className="absolute -left-10 -top-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-[60px]" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {!isDataLoaded.wearables ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                                <Skeleton className="w-1/2 h-3" />
                                <Skeleton className="w-3/4 h-8" />
                            </div>
                        ))
                    ) : (
                        <>
                            <StatCard color="text-rose-500" icon={<Heart size={18} />} label="Cardio" value={latestWearable?.heartRate || '--'} unit="bpm" />
                            <StatCard color="text-amber-500" icon={<Zap size={18} />} label="Passos" value={latestWearable?.steps.toLocaleString() || '0'} unit="hoje" />
                            <StatCard color="text-indigo-500" icon={<Activity size={18} />} label="Meta" value="85" unit="%" />
                            <StatCard color="text-emerald-500" icon={<TrendingUp size={18} />} label="Sleep" value="7.5" unit="hrs" />
                        </>
                    )}
                </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
                {/* AI Insight Card */}
                {!isDataLoaded.insights || isGeneratingInsight ? (
                    <CardSkeleton />
                ) : (
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-[80px] -mr-16 -mt-16" />
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-3 text-indigo-600">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <Zap size={22} className="fill-indigo-100" />
                                </div>
                                <h3 className="text-base font-bold">Análise Inteligente</h3>
                            </div>
                            {insight && (
                                <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                                    SCORE +{insight.bioScore || 0}
                                </div>
                            )}
                        </div>

                        {insight ? (
                            <div className="relative z-10 space-y-6 flex-1">
                                <p className="text-slate-600 leading-relaxed">{insight.text}</p>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-4">
                                    <div className="text-2xl mt-1">💡</div>
                                    <p className="text-sm text-slate-700 font-medium">{insight.actionableTip}</p>
                                </div>
                                <button
                                    onClick={generateInsight}
                                    className="w-full py-4 rounded-xl border border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-50 transition-all text-sm mt-auto"
                                >
                                    Atualizar Análise
                                </button>
                            </div>
                        ) : (
                            <div className="relative z-10 flex flex-col items-center justify-center py-10 text-center flex-1">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <Zap size={32} className="text-slate-300" />
                                </div>
                                <p className="text-slate-500 mb-6 max-w-[200px]">Descubra o que seus dados biológicos dizem sobre você.</p>
                                <button
                                    onClick={generateInsight}
                                    className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
                                >
                                    Gerar Primeira Análise
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* History List */}
            {insightsHistory.length > 1 && (
                <div className="lg:col-span-12 mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Histórico de Insights</h3>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{insightsHistory.length - 1} registros</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {insightsHistory.slice(1, 7).map((h, i) => (
                            <div key={h.id || i} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                        <History size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate">{h.text}</p>
                                        <p className="text-[11px] text-slate-400 font-medium">{new Date(h.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function StatCard({ color, icon, label, value, unit }: { color: string, icon: React.ReactNode, label: string, value: any, unit: string }) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`flex items-center gap-2 ${color} mb-3`}>
                {icon}
                <span className="text-[10px] font-extrabold uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tracking-tight">{value}</span>
                <span className="text-slate-400 text-[10px] font-bold uppercase">{unit}</span>
            </div>
        </div>
    );
}
