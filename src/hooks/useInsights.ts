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
import { HealthInsight, OperationType } from '../types';

export function useInsights(userId: string | undefined, onFirestoreError: (error: any, op: OperationType, path: string) => void) {
    const [insight, setInsight] = useState<HealthInsight | null>(null);
    const [insightsHistory, setInsightsHistory] = useState<HealthInsight[]>([]);
    const [bioScore, setBioScore] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const profilePath = `users/${userId}`;
        const unsubscribeProfile = onSnapshot(doc(db, profilePath), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setBioScore(data.bio_score || data.bioScore || 0);
            }
        }, (error) => onFirestoreError(error, OperationType.GET, profilePath));

        const insightsPath = `users/${userId}/insights`;
        const insightsQuery = query(collection(db, insightsPath), orderBy('timestamp', 'desc'), limit(10));
        const unsubscribeInsights = onSnapshot(insightsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as HealthInsight));
            if (data.length > 0) setInsight(data[0]);
            setInsightsHistory(data);
            setLoading(false);
        }, (error) => {
            onFirestoreError(error, OperationType.GET, insightsPath);
            setLoading(false);
        });

        return () => {
            unsubscribeProfile();
            unsubscribeInsights();
        };
    }, [userId]);

    return { insight, insightsHistory, bioScore, loading };
}
