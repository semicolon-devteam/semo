export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      <div className="h-6 w-24 bg-gray-200 rounded mb-6" />
      <div className="bg-white border rounded-xl p-6 mb-6">
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-96 bg-gray-200 rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
