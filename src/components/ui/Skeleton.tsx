"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

export function ItemSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center gap-3 shadow-sm">
      <Skeleton className="w-6 h-6 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4 space-y-6">
        <Skeleton className="h-4 w-20" />
        {[1, 2, 3, 4].map((i) => (
          <ItemSkeleton key={i} />
        ))}
      </main>
    </div>
  );
}
