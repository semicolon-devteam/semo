export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-gray-200 rounded mb-8" />
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({length: 8}).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
