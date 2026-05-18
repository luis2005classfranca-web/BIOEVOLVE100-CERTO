import React from 'react';
import { motion } from 'motion/react';
import { Camera, X, Plus, Loader2, AlertCircle, CheckCircle2, RotateCcw, BrainCircuit, FileText } from 'lucide-react';
import { ExamRecord } from '../../types';
import Markdown from 'react-markdown';

interface HealthScanProps {
    isCameraActive: boolean;
    isProcessing: boolean;
    isSaving: boolean;
    isExplaining: boolean;
    explanation: string | null;
    errorMessage: string | null;
    isQuotaError?: boolean;
    scanResult: ExamRecord[] | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    startCamera: () => void;
    stopCamera: () => void;
    captureImage: () => void;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setScanResult: (res: ExamRecord[] | null) => void;
    confirmScan: () => void;
    handleExplain: () => void;
    resetExplanation: () => void;
    retryExtraction?: () => void;
}

export default function HealthScan({
    isCameraActive,
    isProcessing,
    isSaving,
    isExplaining,
    explanation,
    errorMessage,
    isQuotaError,
    scanResult,
    videoRef,
    canvasRef,
    fileInputRef,
    startCamera,
    stopCamera,
    captureImage,
    handleImageUpload,
    setScanResult,
    confirmScan,
    handleExplain,
    resetExplanation,
    retryExtraction
}: HealthScanProps) {
    // Group analysis by category
    const groupedResults = React.useMemo(() => {
        if (!scanResult) return {};
        return scanResult.reduce((acc, curr) => {
            const cat = curr.category || 'Outros';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(curr);
            return acc;
        }, {} as Record<string, ExamRecord[]>);
    }, [scanResult]);

    return (
        <motion.div
            key="scan"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
        >
            {!scanResult && !explanation && (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    {isCameraActive ? (
                        <div className="w-full aspect-square bg-black rounded-2xl overflow-hidden relative">
                            <video 
                                ref={videoRef as any} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <button onClick={stopCamera} className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30">
                                    <X size={24} />
                                </button>
                                <button onClick={captureImage} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-xl border-4 border-indigo-100">
                                    <div className="w-12 h-12 border-2 border-indigo-600 rounded-full" />
                                </button>
                            </div>
                            <canvas ref={canvasRef as any} className="hidden" />
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                <Camera size={40} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Processar Documento</h2>
                                <p className="text-sm text-slate-500 mt-1">Tire uma foto ou tire um print do seu exame</p>
                            </div>
                        </>
                    )}
                    <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        ref={fileInputRef as any}
                        onChange={handleImageUpload}
                    />
                    <div className="w-full flex flex-col gap-2">
                        {!isCameraActive && (
                            <>
                                <button onClick={startCamera} disabled={isProcessing} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                                    <Camera size={20} />
                                    Usar Câmera
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full bg-white text-indigo-600 border-2 border-indigo-50 py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                    {isProcessing ? 'Analisando...' : 'Selecionar Arquivo'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className={`p-6 rounded-[2rem] flex flex-col gap-4 shadow-xl ${isQuotaError ? 'bg-amber-50 border border-amber-100 text-amber-900 shadow-amber-100/50' : 'bg-rose-50 border border-rose-100 text-rose-800 shadow-rose-100/50'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-xl shrink-0 ${isQuotaError ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-500'}`}>
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-lg leading-tight mb-1">
                                {isQuotaError ? 'Limite Temporário Atingido' : 'Ops! Algo deu errado'}
                            </p>
                            <p className="text-sm opacity-80 leading-relaxed">
                                {errorMessage}
                            </p>
                        </div>
                    </div>
                    {isQuotaError && retryExtraction && (
                        <div className="pt-2">
                            <button 
                                onClick={retryExtraction}
                                className="w-full py-4 bg-white text-amber-800 border-2 border-amber-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-amber-100 transition-all active:scale-95 group"
                            >
                                <RotateCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                                Tentar Analisar Agora
                            </button>
                            <p className="text-[10px] text-center mt-3 font-bold uppercase tracking-widest text-amber-600/60">
                                A IA reseta o limite de uso em alguns segundos
                            </p>
                        </div>
                    )}
                </div>
            )}

            {scanResult && !explanation && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 size={24} />
                            <h3 className="text-lg font-bold">Verifique os Dados</h3>
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{scanResult.length} itens</span>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {Object.entries(groupedResults).map(([category, items]) => (
                            <div key={category} className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{category}</h4>
                                <div className="grid gap-3">
                                    {items.map((res, idx) => (
                                        <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-bold text-slate-700">{res.analyte}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{res.date}</span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-bold text-slate-900">{res.value}</span>
                                                <span className="text-xs text-slate-400">{res.unit}</span>
                                                {res.referenceRange && (
                                                    <span className="ml-auto text-[10px] bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-medium whitespace-nowrap">Ref: {res.referenceRange}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-4 sticky bottom-24 bg-[#F8FAFC]/80 backdrop-blur-sm p-4 -mx-4 rounded-t-3xl">
                        <button onClick={() => setScanResult(null)} className="flex-1 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-600 transition-colors hover:bg-slate-50">Descartar</button>
                        <button 
                            onClick={handleExplain} 
                            disabled={isExplaining} 
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                        >
                            {isExplaining ? <Loader2 className="animate-spin" size={20} /> : <BrainCircuit size={20} />}
                            {isExplaining ? 'Interpretando...' : 'Prosseguir para Resumo'}
                        </button>
                    </div>
                </div>
            )}

            {explanation && (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <FileText size={24} />
                        <h3 className="text-lg font-bold">Resumo para o Paciente</h3>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-indigo-50 shadow-xl shadow-indigo-50/50">
                        <div className="prose prose-sm prose-slate max-w-none text-slate-600 prose-headings:text-indigo-900 prose-headings:font-bold prose-strong:text-indigo-600">
                            <Markdown>{explanation}</Markdown>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button onClick={resetExplanation} className="flex-1 py-4 border border-slate-200 bg-white rounded-2xl font-bold text-slate-600 hover:bg-slate-50">Voltar</button>
                        <button 
                            onClick={confirmScan} 
                            disabled={isSaving} 
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar no Histórico'}
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
