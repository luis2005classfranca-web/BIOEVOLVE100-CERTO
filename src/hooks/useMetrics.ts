import { useState, useEffect } from 'react';
import { 
    collection, 
    query, 
    orderBy, 
    limit,
    onSnapshot, 
    doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExamRecord, WearableData, OperationType } from '../types';

export function useMetrics(userId: string | undefined, onFirestoreError: (error: any, op: OperationType, path: string) => void) {
    const [exams, setExams] = useState<ExamRecord[]>([]);
    const [wearableData, setWearableData] = useState<WearableData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const examsPath = `users/${userId}/exams`;
        const examsQuery = query(collection(db, examsPath), orderBy('date', 'desc'));
        const unsubscribeExams = onSnapshot(examsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as ExamRecord));
            setExams(data);
        }, (error) => onFirestoreError(error, OperationType.GET, examsPath));

        const wearablePath = `users/${userId}/wearable_data`;
        const wearableQuery = query(collection(db, wearablePath), orderBy('timestamp', 'desc'), limit(7));
        const unsubscribeWearable = onSnapshot(wearableQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as WearableData));
            // Reverse back to chronological order for the UI
            setWearableData(data.reverse());
            setLoading(false);
        }, (error) => {
            onFirestoreError(error, OperationType.GET, wearablePath);
            setLoading(false);
        });

        return () => {
            unsubscribeExams();
            unsubscribeWearable();
        };
    }, [userId]);

    return { exams, wearableData, loading };
}
