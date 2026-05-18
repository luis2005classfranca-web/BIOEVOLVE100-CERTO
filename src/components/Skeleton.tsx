import React from 'react';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export const Skeleton = ({ className = '', variant = 'rect' }: SkeletonProps) => {
  const baseClasses = "bg-slate-200 overflow-hidden relative";
  const variantClasses = variant === 'circle' ? 'rounded-full' : 'rounded-lg';
  
  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
      />
    </div>
  );
};

export const CardSkeleton = () => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex items-center gap-2">
      <Skeleton className="w-5 h-5" variant="circle" />
      <Skeleton className="w-1/3 h-4" />
    </div>
    <div className="space-y-2">
      <Skeleton className="w-full h-3" />
      <Skeleton className="w-full h-3" />
      <Skeleton className="w-2/3 h-3" />
    </div>
    <Skeleton className="w-full h-10 rounded-xl" />
  </div>
);

export const ExamItemSkeleton = () => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
    <div className="space-y-2">
      <Skeleton className="w-20 h-3" />
      <Skeleton className="w-32 h-4" />
    </div>
    <div className="text-right space-y-1">
      <Skeleton className="w-16 h-6" />
      <Skeleton className="w-12 h-3 ml-auto" />
    </div>
  </div>
);
