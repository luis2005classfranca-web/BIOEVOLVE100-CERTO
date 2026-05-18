import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, AlertCircle, Plus, Trash2, History } from 'lucide-react';
import { ExamRecord } from '../../types';
import { Skeleton, ExamItemSkeleton } from '../Skeleton';

interface TimelineProps {
    exams: ExamRecord[];
    isDataLoaded: boolean;
    deleteExam: (id: string) => void;
    onStartScan: () => void;
}

export default function Timeline({ exams, isDataLoaded, deleteExam, onStartScan }: TimelineProps) {
    return (
        <motion.div
            key="timeline"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex justify-between items-center px-1">
                <h2 className="text-xl font-bold text-slate-800">Evolução Histórica</h2>
                <button onClick={onStartScan} className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                    <Plus size={14} />
                    Adicionar
                </button>
            </div>

            {exams.length === 0 && isDataLoaded && (
                <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                        <History size={32} />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">Nenhum dado histórico disponível ainda.</p>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {!isDataLoaded ? (
                    <>
                        <ExamItemSkeleton />
                        <ExamItemSkeleton />
                        <ExamItemSkeleton />
                        <ExamItemSkeleton />
                    </>
                ) : (
                    exams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exam => (
                        <div key={exam.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex justify-between items-center group relative overflow-hidden hover:border-indigo-100 transition-all">
                             {exam.category && (
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                            )}
                            <div>
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">{exam.category || 'Outros'}</p>
                                <p className="font-bold text-slate-800 text-base">{exam.analyte}</p>
                                <p className="text-[11px] text-slate-400 font-medium">{new Date(exam.date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-xl font-black text-indigo-600 tracking-tight">{exam.value} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{exam.unit}</span></p>
                                    {exam.referenceRange && <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Ref: {exam.referenceRange}</p>}
                                </div>
                                <button onClick={() => deleteExam(exam.id)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
