/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExamRecord {
  id: string;
  date: string;
  analyte: string;
  value: number;
  unit: string;
  referenceRange: string;
  label?: string;
  confidence?: number;
  isCalculated?: boolean;
  imageUrl?: string;
  createdAt?: any;
}

export interface WearableData {
  timestamp: string;
  steps: number;
  heartRate: number;
}

export interface CheckUpResponse {
  mood: string;
  energy: string;
  symptoms: string[];
  notes: string;
}

export interface HealthInsight {
  id?: string;
  timestamp: string;
  text: string;
  actionableTip: string;
  bioScore?: number;
}

export interface UserProfile {
  onboardingComplete: boolean;
  bioScore: number;
  age?: number;
  weight?: number;
  height?: number;
}
