/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Activity,
    Plus,
    TrendingUp,
    User as UserIcon,
    AlertCircle,
    QrCode,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

// Components
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard/Dashboard';
import Timeline from './components/Timeline/Timeline';
import HealthScan from './components/HealthScan/HealthScan';
import Profile from './components/Profile/Profile';

// Hooks
import { useAuth } from './components/AuthProvider';
import { useMetrics } from './hooks/useMetrics';
import { useInsights } from './hooks/useInsights';
import { useCamera } from './hooks/useCamera';

// Services & Utils
import { 
    extractHealthDataFromImage, 
    generateHealthInsight, 
    explainHealthResults 
} from './services/geminiService';
import { ExamRecord, HealthInsight, OperationType } from './types';
import { db, logout, handleFirestoreError } from './lib/firebase';
import { 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    setDoc, 
    writeBatch
} from 'firebase/firestore';

export default function App() {
    const { user, loading: authLoading, isAuthReady } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'scan' | 'profile'>('dashboard');
    
    // State management
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<ExamRecord[] | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);
    const [lastExtractionData, setLastExtractionData] = useState<{ base64: string, mimeType: string } | null>(null);
    const [showConsultationMode, setShowConsultationMode] = useState(false);
    const [quotaExceeded, setQuotaExceeded] = useState(false);
    const [isQuotaError, setIsQuotaError] = useState(false);
    const lastInsightTimeRef = useRef<number>(0);

    const handleAppError = (error: any, op: OperationType, path: string | null) => {
        const errorMsg = error.message || String(error);
        const isFirestoreQuota = errorMsg.includes('Quota limit exceeded') || 
                               errorMsg.includes('quota limit exceeded') || 
                               errorMsg.includes('"isQuotaExceeded":true') ||
                               errorMsg.includes('Quota exceeded');
        
        const isAiQuota = errorMsg.includes('429') || 
                         errorMsg.includes('RESOURCE_EXHAUSTED') || 
                         (error.status === 429) ||
                         (error.error?.includes('Limite da IA') || errorMsg.includes('Limite da IA'));

        if (isFirestoreQuota) {
            if (!quotaExceeded) {
                console.warn(`[Firestore] Limite atingido em ${path}. O app tentará usar dados em cache.`);
                setQuotaExceeded(true);
            }
            return;
        }

        console.error(`Error in ${op} on ${path}:`, error);

        if (isAiQuota) {
            setIsQuotaError(true);
            setErrorMessage("Limite de uso da IA atingido. Tente novamente em 30 segundos.");
            // Clear error automatically after 30s
            setTimeout(() => {
                setIsQuotaError(false);
                setErrorMessage(null);
            }, 30000);
            return;
        }

        // Try to extract cleaner message from stringified JSON if applicable
        let finalMsg = errorMsg;
        try {
            if (errorMsg.startsWith('{')) {
                const parsed = JSON.parse(errorMsg);
                if (parsed.error) finalMsg = parsed.error;
            }
        } catch (e) { /* fallback to original */ }

        setErrorMessage(finalMsg || "Ocorreu um erro inesperado.");
    };

    // Custom Hooks
    const { exams, wearableData, loading: metricsLoading } = useMetrics(user?.uid, handleAppError);
    const { insight, insightsHistory, bioScore, loading: insightsLoading } = useInsights(user?.uid, handleAppError);
    const { isCameraActive, videoRef, canvasRef, startCamera, stopCamera, captureToDataURL } = useCamera();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI Insight Generator
    const generateInsight = async () => {
        if (!user) return;

        // Problem 3 - Cooldown of 60 seconds
        const now = Date.now();
        const secondsSinceLast = (now - lastInsightTimeRef.current) / 1000;
        if (secondsSinceLast < 60) {
            setErrorMessage(`Aguarde mais ${Math.ceil(60 - secondsSinceLast)} segundos para gerar uma nova análise.`);
            return;
        }

        setIsGeneratingInsight(true);
        setErrorMessage(null);
        setIsQuotaError(false);

        try {
            // Problem 4 - Token optimization (Deduplication + Limit)
            // Keep only the most recent unique analyte
            const uniqueExamsMap = new Map();
            exams.forEach(exam => {
                if (!uniqueExamsMap.has(exam.analyte)) {
                    uniqueExamsMap.set(exam.analyte, exam);
                }
            });
            const optimizedExams = Array.from(uniqueExamsMap.values()).slice(0, 15);

            lastInsightTimeRef.current = Date.now();
            const data = await generateHealthInsight(optimizedExams, wearableData.slice(-7));
            const path = `users/${user.uid}/insights`;

            const insightData = {
                user_id: user.uid,
                timestamp: new Date().toISOString(),
                text: data.text,
                actionable_tip: data.actionableTip,
                bio_score: data.bioScore || 0
            };
            
            await addDoc(collection(db, path), insightData);

            if (data.bioScore) {
                await setDoc(doc(db, `users/${user.uid}`), {
                    bio_score: data.bioScore,
                    updated_at: new Date().toISOString()
                }, { merge: true });
            }
        } catch (error: any) {
            handleAppError(error, OperationType.GET, `users/${user.uid}/insights`);
        } finally {
            setIsGeneratingInsight(false);
        }
    };

    // Image Handlers
    const compressImage = (base64: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 2000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = (height / width) * maxDim;
                        width = maxDim;
                    } else {
                        width = (width / height) * maxDim;
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => reject(new Error("Falha ao processar imagem."));
            img.src = base64;
        });
    };

    const handleExtraction = async (base64: string, mimeType: string) => {
        setIsProcessing(true);
        setErrorMessage(null);
        setScanResult(null);
        setExplanation(null);
        setIsExplaining(false);
        setIsQuotaError(false);
        setLastExtractionData({ base64, mimeType });
        
        try {
            let processedImage = base64;
            if (mimeType.startsWith('image/')) {
                processedImage = await compressImage(base64);
            }
            const extracted = await extractHealthDataFromImage(processedImage, mimeType);
            if (!extracted || extracted.length === 0) {
                setErrorMessage("Nenhum dado de saúde claro foi encontrado.");
                return;
            }
            setScanResult(extracted.map(item => ({ ...item, id: '', imageUrl: processedImage } as ExamRecord)));
            setLastExtractionData(null);
        } catch (error: any) {
            handleAppError(error, OperationType.GET, 'api/gemini/extract');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExplain = async () => {
        if (!scanResult) return;
        setIsExplaining(true);
        setErrorMessage(null);
        try {
            const result = await explainHealthResults(scanResult);
            setExplanation(result);
        } catch (error: any) {
            handleAppError(error, OperationType.GET, 'api/gemini/explain');
        } finally {
            setIsExplaining(false);
        }
    };

    const retryExtraction = () => {
        if (lastExtractionData) {
            handleExtraction(lastExtractionData.base64, lastExtractionData.mimeType);
        }
    };

    const handleCapture = async () => {
        const base64 = captureToDataURL();
        if (base64) {
            stopCamera();
            await handleExtraction(base64, 'image/jpeg');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 30 * 1024 * 1024) {
            setErrorMessage("Arquivo muito grande. O limite é 30MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => handleExtraction(reader.result as string, file.type);
        reader.readAsDataURL(file);
    };

    const confirmScan = async () => {
        if (scanResult && user && !isSaving) {
            setIsSaving(true);
            try {
                const batch = writeBatch(db);
                const path = `users/${user.uid}/exams`;
                scanResult.forEach(record => {
                    const newDocRef = doc(collection(db, path));
                    batch.set(newDocRef, {
                        user_id: user.uid,
                        date: record.date || new Date().toISOString().split('T')[0],
                        analyte: record.analyte || 'Indefinido',
                        value: String(record.value || '0'),
                        unit: record.unit || '',
                        reference_range: record.referenceRange || '',
                        category: record.category || 'Outros',
                        imageUrl: record.imageUrl || '',
                        created_at: new Date().toISOString()
                    });
                });
                await batch.commit();
                setScanResult(null);
                setExplanation(null);
                setActiveTab('timeline');
            } catch (error) {
                handleAppError(error, OperationType.UPDATE, `users/${user.uid}/exams`);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const deleteExam = async (examId: string) => {
        if (!user || !window.confirm("Apagar este exame?")) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/exams/${examId}`));
        } catch (error) {
            handleAppError(error, OperationType.DELETE, `users/${user.uid}/exams/${examId}`);
        }
    };

    // Global Paste Listener
    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;
                    setActiveTab('scan');
                    const reader = new FileReader();
                    reader.onload = () => handleExtraction(reader.result as string, item.type);
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [user]);

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando BioEvolve...</div>;
    if (!user) return <LoginScreen />;

    const latestWearable = wearableData.length > 0 ? wearableData[wearableData.length - 1] : null;

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col md:flex-row">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen z-40">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <Activity className="text-indigo-600" size={28} />
                    <h1 className="text-xl font-bold tracking-tight">Bio<span className="text-indigo-600">Evolve</span></h1>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Dashboard" />
                    <SidebarButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={<TrendingUp size={20} />} label="Evolução" />
                    <SidebarButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={<Plus size={20} />} label="Novo Exame" />
                    <SidebarButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={20} />} label="Seu Perfil" />
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button onClick={() => setShowConsultationMode(true)} className="w-full flex items-center gap-3 p-3 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all font-medium">
                        <QrCode size={20} />
                        <span>Compartilhar</span>
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                {quotaExceeded && (
                <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex justify-between items-center text-amber-800 text-[10px] font-bold uppercase tracking-wider relative z-50">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={14} />
                        Limite de acesso ao banco atingido hoje. O app está operando em modo offline.
                    </div>
                    <button onClick={() => setQuotaExceeded(false)} className="p-1 hover:bg-amber-100 rounded">
                        <X size={12} />
                    </button>
                </div>
            )}
            <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 flex justify-between items-center h-16 md:hidden">
                <div className="flex items-center gap-3">
                    <Activity className="text-indigo-600" size={24} />
                    <h1 className="text-lg font-bold">Bio<span className="text-indigo-600">Evolve</span></h1>
                </div>
                <button onClick={() => setShowConsultationMode(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
                    <QrCode size={20} />
                </button>
            </header>

            <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {activeTab === 'dashboard' && (
                        <Dashboard 
                            currentBioScore={bioScore || 0}
                            latestWearable={latestWearable}
                            wearableData={wearableData}
                            insight={insight}
                            insightsHistory={insightsHistory}
                            isDataLoaded={{ wearables: !metricsLoading, insights: !insightsLoading }}
                            isGeneratingInsight={isGeneratingInsight}
                            generateInsight={generateInsight}
                        />
                    )}
                    {activeTab === 'timeline' && (
                        <Timeline 
                            exams={exams} 
                            isDataLoaded={!metricsLoading} 
                            deleteExam={deleteExam}
                            onStartScan={() => setActiveTab('scan')}
                        />
                    )}
                    {activeTab === 'scan' && (
                        <HealthScan 
                            isCameraActive={isCameraActive}
                            isProcessing={isProcessing}
                            isSaving={isSaving}
                            isExplaining={isExplaining}
                            explanation={explanation}
                            errorMessage={errorMessage}
                            isQuotaError={isQuotaError}
                            scanResult={scanResult}
                            videoRef={videoRef}
                            canvasRef={canvasRef}
                            fileInputRef={fileInputRef}
                            startCamera={startCamera}
                            stopCamera={stopCamera}
                            captureImage={handleCapture}
                            handleImageUpload={handleImageUpload}
                            setScanResult={setScanResult}
                            confirmScan={confirmScan}
                            handleExplain={handleExplain}
                            resetExplanation={() => setExplanation(null)}
                            retryExtraction={retryExtraction}
                        />
                    )}
                    {activeTab === 'profile' && <Profile user={user} logout={logout} />}
                </AnimatePresence>
            </main>

            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-4 py-2 z-40 pb-safe">
                <div className="max-w-md mx-auto flex justify-between items-center px-2">
                    <NavButton 
                        active={activeTab === 'dashboard'} 
                        onClick={() => setActiveTab('dashboard')} 
                        icon={<Activity size={22} />} 
                        label="Início" 
                    />
                    <NavButton 
                        active={activeTab === 'timeline'} 
                        onClick={() => setActiveTab('timeline')} 
                        icon={<TrendingUp size={22} />} 
                        label="Evolução" 
                    />
                    <div className="relative -mt-10 px-2">
                        <button 
                            onClick={() => setActiveTab('scan')} 
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 transition-all active:scale-90 ${activeTab === 'scan' ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' : 'bg-white text-indigo-600 border-2 border-indigo-50 hover:bg-slate-50'}`}
                            title="Novo Exame"
                        >
                            <Plus size={32} />
                        </button>
                    </div>
                    <NavButton 
                        active={activeTab === 'profile'} 
                        onClick={() => setActiveTab('profile')} 
                        icon={<UserIcon size={22} />} 
                        label="Perfil" 
                    />
                    {/* Ghost button to balance the 4 actual items if needed, but flex justify-between is better */}
                </div>
            </nav>

            <AnimatePresence>
                {showConsultationMode && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-sm rounded-[32px] p-8 space-y-6 relative">
                            <button onClick={() => setShowConsultationMode(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                            <h2 className="text-2xl font-bold text-center">Modo Consulta</h2>
                            <div className="flex justify-center"><QRCodeSVG value="https://bioevolve.health/share" size={200} /></div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
            </div>
        </div>
    );
}

function SidebarButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick} 
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all flex-1 ${active ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-500'}`}
        >
            <div className={`p-1 rounded-xl transition-colors ${active ? 'bg-indigo-50' : ''}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-bold tracking-tight transition-opacity ${active ? 'opacity-100' : 'opacity-80'}`}>
                {label}
            </span>
        </button>
    );
}
