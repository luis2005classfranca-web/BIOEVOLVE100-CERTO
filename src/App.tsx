/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Activity,
    Camera,
    History,
    User,
    Plus,
    TrendingUp,
    Heart,
    Moon,
    Zap,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    QrCode,
    X,
    ArrowLeft,
    Trash2,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { extractHealthDataFromImage, generateHealthInsight } from './services/geminiService';
import { ExamRecord, WearableData, HealthInsight } from './types';
import { useAuth } from './components/AuthProvider';
import { db, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    doc, 
    setDoc, 
    getDoc,
    limit,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import LoginScreen from './components/LoginScreen';

export default function App() {
    const { user, loading, isAuthReady } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'scan' | 'profile'>('dashboard');
    const [exams, setExams] = useState<ExamRecord[]>([]);
    const [wearableData, setWearableData] = useState<WearableData[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ExamRecord[] | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showConsultationMode, setShowConsultationMode] = useState(false);
    const [bioScore, setBioScore] = useState(0);
    const [insight, setInsight] = useState<HealthInsight | null>(null);
    const [insightsHistory, setInsightsHistory] = useState<HealthInsight[]>([]);
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [quotaExceeded, setQuotaExceeded] = useState(false);

    const onFirestoreError = (error: any, op: OperationType, path: string | null) => {
        try {
            handleFirestoreError(error, op, path);
        } catch (e: any) {
            let isQuota = false;
            try {
                const parsed = JSON.parse(e.message);
                if (parsed.isQuotaExceeded) isQuota = true;
            } catch (err) {
                if (e.message.includes('"isQuotaExceeded":true')) isQuota = true;
            }

            if (isQuota) {
                setQuotaExceeded(true);
                return; // Suppress re-throw for quota errors as we handle them via UI
            }
            throw e;
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Camera Functions
    const startCamera = async () => {
        setIsCameraActive(true);
        setErrorMessage(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error("Camera access error:", error);
            setErrorMessage("Não foi possível acessar a câmera. Verifique as permissões.");
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const captureImage = async () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            stopCamera();
            
            setIsProcessing(true);
            setErrorMessage(null);
            setScanResult(null);

            try {
                const compressed = await compressImage(base64);
                const extracted = await extractHealthDataFromImage(compressed, 'image/jpeg');

                if (!extracted || extracted.length === 0) {
                    setErrorMessage("Nenhum dado de saúde claro foi encontrado na foto. Tente uma captura mais nítida.");
                    return;
                }

                const records: ExamRecord[] = extracted.map(item => ({
                    ...item,
                    id: '',
                    imageUrl: compressed
                } as ExamRecord));
                setScanResult(records);
            } catch (error) {
                console.error("Camera extraction failed", error);
                setErrorMessage(error instanceof Error ? error.message : "Erro ao processar foto da câmera.");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    // Global Paste Listener
    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    // Switch to scan tab immediately for feedback
                    setActiveTab('scan');
                    setIsProcessing(true);
                    setErrorMessage(null);
                    setScanResult(null);

                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                            const compressed = await compressImage(base64);
                            const extracted = await extractHealthDataFromImage(compressed, item.type);
                            
                            if (!extracted || extracted.length === 0) {
                                setErrorMessage("Nenhum dado de saúde claro foi encontrado no print. Verifique se a imagem está nítida e tente novamente.");
                                return;
                            }

                            const records: ExamRecord[] = extracted.map(item => ({
                                ...item,
                                id: '',
                                imageUrl: compressed
                            } as ExamRecord));
                            setScanResult(records);
                        } catch (error) {
                            console.error("Paste extraction failed", error);
                            setErrorMessage(error instanceof Error ? error.message : "Erro ao processar imagem colada.");
                        } finally {
                            setIsProcessing(false);
                        }
                    };
                    reader.onerror = () => {
                        setErrorMessage("Falha ao ler imagem da área de transferência.");
                        setIsProcessing(false);
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [user, isAuthReady]);

    // Listeners for Firestore data
    useEffect(() => {
        if (!user || !isAuthReady) return;

        const examsPath = `users/${user.uid}/exams`;
        const examsQuery = query(collection(db, examsPath), orderBy('date', 'desc'));
        const unsubscribeExams = onSnapshot(examsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as ExamRecord));
            setExams(data);
        }, (error) => onFirestoreError(error, OperationType.GET, examsPath));

        const wearablePath = `users/${user.uid}/wearable_data`;
        const wearableQuery = query(collection(db, wearablePath), orderBy('timestamp', 'asc'));
        const unsubscribeWearable = onSnapshot(wearableQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as WearableData));
            setWearableData(data);
        }, (error) => onFirestoreError(error, OperationType.GET, wearablePath));

        const profilePath = `users/${user.uid}`;
        const unsubscribeProfile = onSnapshot(doc(db, profilePath), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setBioScore(data.bio_score || data.bioScore || 0);
            }
        }, (error) => onFirestoreError(error, OperationType.GET, profilePath));

        const insightsPath = `users/${user.uid}/insights`;
        const insightsQuery = query(collection(db, insightsPath), orderBy('timestamp', 'desc'));
        const unsubscribeInsights = onSnapshot(insightsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as HealthInsight));
            if (data.length > 0) setInsight(data[0]);
            setInsightsHistory(data);
        }, (error) => onFirestoreError(error, OperationType.GET, insightsPath));

        return () => {
            unsubscribeExams();
            unsubscribeWearable();
            unsubscribeProfile();
            unsubscribeInsights();
        };
    }, [user, isAuthReady]);

    const generateInsight = async () => {
        if (!user) return;
        setIsGeneratingInsight(true);
        setErrorMessage(null);
        try {
            // Send more history for long-term analysis (last 20 exams)
            const data = await generateHealthInsight(exams.slice(0, 20), wearableData.slice(-7));
            const path = `users/${user.uid}/insights`;

            // Save insight
            const insightData = {
                user_id: user.uid,
                timestamp: new Date().toISOString(),
                text: data.text,
                actionable_tip: data.actionableTip,
                bioScore: data.bioScore || 0
            };
            
            try {
                await addDoc(collection(db, path), insightData);

                // Update user profile with bioScore
                if (data.bioScore) {
                    await setDoc(doc(db, `users/${user.uid}`), {
                        bioScore: data.bioScore,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
            } catch (err) {
                onFirestoreError(err, OperationType.WRITE, path);
            }
        } catch (error) {
            console.error(error);
            setErrorMessage("Não foi possível gerar seu insight no momento.");
        } finally {
            setIsGeneratingInsight(false);
        }
    };

    const compressImage = (base64: string): Promise<string> => {
        return new Promise((resolve) => {
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
            img.src = base64;
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setErrorMessage(null);
        setScanResult(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            let base64 = reader.result as string;

            try {
                // Only compress if it's an image, not a PDF
                if (file.type.startsWith('image/')) {
                    base64 = await compressImage(base64);
                }

                const extracted = await extractHealthDataFromImage(base64, file.type);

                if (!extracted || extracted.length === 0) {
                    setErrorMessage("Nenhum dado de saúde claro foi encontrado. Tente uma foto mais aproximada ou outro documento.");
                    return;
                }

                const records: ExamRecord[] = extracted.map(item => ({
                    ...item,
                    id: '',
                    imageUrl: base64
                } as ExamRecord));
                setScanResult(records);
            } catch (error) {
                console.error("Extraction failed", error);
                setErrorMessage(error instanceof Error ? error.message : "Erro desconhecido ao processar documento.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            setErrorMessage("Erro ao ler o arquivo selecionado.");
            setIsProcessing(false);
        };
        reader.readAsDataURL(file);
    };

    const deleteExam = async (examId: string) => {
        if (!user || !window.confirm("Tem certeza que deseja apagar este exame?")) return;
        
        try {
            const path = `users/${user.uid}/exams/${examId}`;
            await deleteDoc(doc(db, path));
            setErrorMessage(null);
        } catch (error) {
            onFirestoreError(error, OperationType.DELETE, `users/${user.uid}/exams/${examId}`);
            setErrorMessage("Erro ao apagar exame.");
        }
    };

    const confirmScan = async () => {
        if (scanResult && user && !isSaving) {
            setIsSaving(true);
            setErrorMessage(null);
            try {
                // Deduplication check
                const newRecords = scanResult.filter(newRecord => 
                    !exams.some(existing => 
                        existing.date === newRecord.date && 
                        existing.analyte === newRecord.analyte && 
                        existing.value === newRecord.value
                    )
                );

                const duplicates = scanResult.filter(newRecord => 
                    exams.some(existing => 
                        existing.date === newRecord.date && 
                        existing.analyte === newRecord.analyte && 
                        existing.value === newRecord.value
                    )
                );

                if (newRecords.length === 0 && duplicates.length > 0) {
                    setErrorMessage("Todos os exames detectados já estão cadastrados.");
                    setIsSaving(false);
                    return;
                }

                if (newRecords.length > 0) {
                    const batch = writeBatch(db);
                    const path = `users/${user.uid}/exams`;
                    
                    newRecords.forEach(record => {
                        const newDocRef = doc(collection(db, path));
                        batch.set(newDocRef, {
                            user_id: user.uid,
                            date: record.date || new Date().toISOString().split('T')[0],
                            analyte: record.analyte || 'Indefinido',
                            value: String(record.value || '0'),
                            unit: record.unit || '',
                            reference_range: record.referenceRange || '',
                            imageUrl: record.imageUrl || '',
                            created_at: new Date().toISOString()
                        });
                    });

                    await batch.commit();
                }

                if (duplicates.length > 0) {
                    alert(`${duplicates.length} exame(s) foram ignorados por já estarem cadastrados.`);
                }

                setScanResult(null);
                setIsScanning(false);
                setActiveTab('timeline');
            } catch (error) {
                onFirestoreError(error, OperationType.WRITE, `users/${user.uid}/exams`);
                setErrorMessage("Erro ao salvar exames. Verifique sua conexão.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-full"></div>
                    <p className="text-slate-500 font-medium">Carregando seus dados...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    if (quotaExceeded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-6">
                    <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Limite de Uso Atingido</h1>
                    <p className="text-slate-600">
                        O aplicativo atingiu o limite diário de processamento do banco de dados (Firestore) na conta gratuita do Firebase. 
                    </p>
                    <p className="text-slate-600 text-sm italic">
                        O limite será redefinido automaticamente amanhã. Por favor, tente novamente mais tarde ou entre em contato com o suporte.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                    >
                        Tentar Novamente
                    </button>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest pt-8">
                        Firebase Free Tier Quota Exceeded
                    </p>
                </div>
            </div>
        );
    }

    const latestWearable = wearableData.length > 0 ? wearableData[wearableData.length - 1] : null;
    
    // BioScore Logic:
    // 1. Priority: State bioScore (from AI insight in Firestore)
    // 2. Fallback: Local calculation if state is 0 and no insights exist
    const localCalcBioScore = exams.length === 0 && wearableData.length === 0 ? 0 : Math.min(100, 50 + exams.length * 5 + wearableData.length * 2);
    const currentBioScore = (bioScore > 0 || insightsHistory.length > 0) ? bioScore : localCalcBioScore;

    // Group exams by analyte for smarter selection in charts
    const analytes = Array.from(new Set(exams.map(e => e.analyte)));
    const selectedAnalyte = analytes.includes('Glicose') ? 'Glicose' : (analytes[0] || '');

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 flex justify-between items-center h-16">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                            Bio<span className="text-indigo-600">Evolve</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Health Intelligence</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowConsultationMode(true)}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                >
                    <QrCode size={20} />
                </button>
            </header>

            <main className="max-w-md mx-auto p-6 space-y-6">
                <AnimatePresence mode="wait">
                    {activeTab === 'dashboard' && (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* BioScore Card */}
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-indigo-100 text-sm font-medium">Seu BioScore</p>
                                            <h2 className="text-5xl font-bold mt-1">{currentBioScore}</h2>
                                        </div>
                                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                                            <TrendingUp size={24} />
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm text-indigo-100 leading-relaxed">
                                        {currentBioScore > 0
                                            ? "Este score reflete sua análise de evolução baseada em documentos e wearables recentes."
                                            : "Adicione seus dados para a IA calcular seu primeiro BioScore histórico."
                                        }
                                    </p>
                                </div>
                                {/* Decorative circles */}
                                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                                <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
                            </div>

                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 text-rose-500 mb-2">
                                        <Heart size={18} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Batimentos</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold">{latestWearable ? latestWearable.heartRate : '--'}</span>
                                        <span className="text-slate-400 text-xs">bpm</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                                        <Zap size={18} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Passos</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold">{latestWearable ? latestWearable.steps.toLocaleString() : '0'}</span>
                                        <span className="text-slate-400 text-xs">hoje</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Insight Card */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10" />
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        <Zap size={20} className="fill-indigo-100" />
                                        <h3 className="text-sm font-bold">Insight da IA</h3>
                                    </div>
                                    {insight && (
                                        <div className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg uppercase">
                                            Score: {insight.bioScore || 0}
                                        </div>
                                    )}
                                </div>

                                {insight ? (
                                    <div className="relative z-10 space-y-4">
                                        <p className="text-sm text-slate-600 leading-relaxed">{insight.text}</p>
                                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3">
                                            <div className="text-xl">💡</div>
                                            <p className="text-xs text-indigo-800 font-medium my-auto">{insight.actionableTip}</p>
                                        </div>
                                        <button
                                            onClick={generateInsight}
                                            disabled={isGeneratingInsight}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 mt-2 transition-opacity"
                                        >
                                            {isGeneratingInsight ? 'Gerando novo insight...' : 'Atualizar Insight'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative z-10 flex flex-col items-center justify-center py-4 text-center">
                                        <p className="text-sm text-slate-500 mb-4">Descubra o que seus dados dizem sobre você esta semana.</p>
                                        <button
                                            onClick={generateInsight}
                                            disabled={isGeneratingInsight}
                                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-indigo-200 disabled:opacity-50 transition-all hover:bg-indigo-700 active:scale-95"
                                        >
                                            {isGeneratingInsight ? 'Processando dados...' : 'Gerar Insight'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Analysis History */}
                            {insightsHistory.length > 1 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-800">Análises Anteriores</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{insightsHistory.length - 1} análises</span>
                                    </div>
                                    <div className="space-y-3">
                                        {insightsHistory.slice(1, 4).map((h, i) => (
                                            <div key={h.id || i} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                        <History size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{h.text}</p>
                                                        <p className="text-[10px] text-slate-400">{new Date(h.timestamp).toLocaleDateString()} • {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-xs font-bold text-indigo-600">Score: {h.bioScore || 0}</span>
                                                    <ChevronRight size={14} className="text-slate-300" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Daily Check-up Prompt */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-4">
                                <div className="bg-indigo-600 text-white p-3 rounded-xl">
                                    <Activity size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-indigo-900">Check-up Diário</h3>
                                    <p className="text-xs text-indigo-700">Como você está se sentindo hoje?</p>
                                </div>
                                <ChevronRight className="text-indigo-400" size={20} />
                            </div>

                            {/* Weekly Activity Chart */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[200px] flex flex-col">
                                <h3 className="text-sm font-bold text-slate-800 mb-4">Atividade Semanal</h3>
                                {wearableData.length > 0 ? (
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={wearableData}>
                                                <defs>
                                                    <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="timestamp" hide />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Area type="monotone" dataKey="steps" stroke="#6366f1" fillOpacity={1} fill="url(#colorSteps)" strokeWidth={3} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                            <History size={24} />
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">Nenhum dado de atividade ainda.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'timeline' && (
                        <motion.div
                            key="timeline"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-800">Evolução Histórica</h2>
                                <div className="flex gap-2">
                                    {analytes.slice(0, 2).map(a => (
                                        <button key={a} className={`px-3 py-1 rounded-full text-xs font-medium ${selectedAnalyte === a ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
                                {exams.length > 0 ? (
                                    <>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={exams.filter(e => e.analyte === selectedAnalyte).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {month: 'short', day: 'numeric'})} />
                                                    <YAxis tick={{ fontSize: 10 }} />
                                                    <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                                                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                                            <AlertCircle className="text-indigo-500" size={18} />
                                            <p className="text-xs text-slate-600">
                                                Exibindo tendência para <span className="font-bold">{selectedAnalyte}</span>. Use o dashboard para ver insights comparativos de IA.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="w-16 h-16 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center">
                                            <Plus size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">Nenhum exame cadastrado</h3>
                                            <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">Digitalize seu primeiro exame para ver suas tendências aqui.</p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('scan')}
                                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full transition-all active:scale-95"
                                        >
                                            Digitalizar agora
                                        </button>
                                    </div>
                                )}
                            </div>

                            {exams.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-800 px-1">Exames Recentes</h3>
                                    {exams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exam => (
                                        <div key={exam.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group relative">
                                            <div>
                                                <p className="text-xs text-slate-400 font-medium">{new Date(exam.date).toLocaleDateString('pt-BR')}</p>
                                                <p className="font-bold text-slate-800">{exam.analyte}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-indigo-600">{exam.value} <span className="text-xs font-normal text-slate-400">{exam.unit}</span></p>
                                                    <p className="text-[10px] text-slate-400">Ref: {exam.referenceRange}</p>
                                                </div>
                                                <button 
                                                    onClick={() => deleteExam(exam.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Apagar exame"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'scan' && (
                        <motion.div
                            key="scan"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-6"
                        >
                    <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                                {isCameraActive ? (
                                    <div className="w-full aspect-square bg-black rounded-2xl overflow-hidden relative">
                                        <video 
                                            ref={videoRef} 
                                            autoPlay 
                                            playsInline 
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                            <button 
                                                onClick={stopCamera}
                                                className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30"
                                            >
                                                <X size={24} />
                                            </button>
                                            <button 
                                                onClick={captureImage}
                                                className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-xl border-4 border-indigo-100 active:scale-95 transition-transform"
                                            >
                                                <div className="w-12 h-12 border-2 border-indigo-600 rounded-full" />
                                            </button>
                                        </div>
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                            <Camera size={40} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Processar Print</h2>
                                            <p className="text-sm text-slate-500 mt-1">Tire um print do seu exame e cole (Ctrl+V) aqui</p>
                                        </div>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                />
                                <div className="w-full flex flex-col gap-2">
                                    {!isCameraActive && (
                                        <>
                                            <button
                                                onClick={startCamera}
                                                disabled={isProcessing}
                                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Camera size={20} />
                                                Usar Câmera
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                                className="w-full bg-white text-indigo-600 border-2 border-indigo-50 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all disabled:opacity-50"
                                            >
                                                {isProcessing ? 'Analisando documento...' : 'Selecionar Arquivo'}
                                            </button>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">ou simplesmente cole (Ctrl+V)</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700"
                                >
                                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm font-medium">{errorMessage}</p>
                                </motion.div>
                            )}

                            {scanResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-4"
                                >
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <CheckCircle2 size={20} />
                                        <h3 className="font-bold">Dados Extraídos</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {scanResult.map((res, idx) => (
                                            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
                                                {res.isCalculated && (
                                                    <div className="absolute top-0 right-0 bg-indigo-500 text-[8px] text-white px-2 py-0.5 rounded-bl-lg font-bold uppercase">
                                                        Calculado pela IA
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{res.analyte}</span>
                                                        {res.label && res.label !== res.analyte && (
                                                            <span className="text-[10px] text-slate-400 italic">Original: {res.label}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-medium">{res.date}</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <p className="text-xl font-bold text-slate-900">{res.value} <span className="text-sm font-normal text-slate-400">{res.unit}</span></p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setScanResult(null)}
                                            className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600"
                                        >
                                            Descartar
                                        </button>
                                        <button
                                            onClick={confirmScan}
                                            disabled={isSaving}
                                            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={20} />
                                                    Salvando...
                                                </>
                                            ) : 'Confirmar'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'profile' && (
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
                                        <span className="text-3xl font-bold uppercase">{user?.email?.[0] || user?.uid?.[0] || <User size={48} />}</span>
                                    )}
                                </div>
                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-slate-800">{user?.displayName || (user?.email ? user.email.split('@')[0] : 'Usuário Anônimo')}</h2>
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
                                    onClick={() => logout()}
                                    className="p-4 flex items-center gap-4 hover:bg-rose-50 cursor-pointer text-rose-600"
                                >
                                    <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><X size={20} /></div>
                                    <div className="flex-1"><p className="text-sm font-bold">Sair da Conta</p></div>
                                    <ChevronRight size={18} className="text-slate-300" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-3 z-40">
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <NavButton
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        icon={<Activity size={24} />}
                        label="Início"
                    />
                    <NavButton
                        active={activeTab === 'timeline'}
                        onClick={() => setActiveTab('timeline')}
                        icon={<TrendingUp size={24} />}
                        label="Saúde"
                    />
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`-mt-12 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${activeTab === 'scan' ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-indigo-600 border-2 border-indigo-50'}`}
                    >
                        <Plus size={32} />
                    </button>
                    <NavButton
                        active={activeTab === 'profile'}
                        onClick={() => setActiveTab('profile')}
                        icon={<User size={24} />}
                        label="Perfil"
                    />
                    <NavButton
                        active={false}
                        onClick={() => { }}
                        icon={<History size={24} />}
                        label="Logs"
                    />
                </div>
            </nav>

            {/* Consultation Mode Modal */}
            <AnimatePresence>
                {showConsultationMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-8 space-y-6 relative"
                        >
                            <button
                                onClick={() => setShowConsultationMode(false)}
                                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"
                            >
                                <X size={20} />
                            </button>
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-bold text-slate-800">Modo Consulta</h2>
                                <p className="text-sm text-slate-500">Mostre este código ao seu médico para compartilhar seu dashboard técnico.</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border-4 border-indigo-50 flex justify-center">
                                <QRCodeSVG value="https://ais-dev.health/consult/user-data" size={200} />
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-2xl flex items-start gap-3">
                                <AlertCircle className="text-indigo-600 mt-0.5" size={18} />
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    Seu médico terá acesso temporário aos seus gráficos, fotos originais dos exames e tendências biométricas.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowConsultationMode(false)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold"
                            >
                                Encerrar Sessão
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}
        >
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </button>
    );
}
