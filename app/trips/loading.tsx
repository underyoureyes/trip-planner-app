export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-brand-900 to-brand-700 px-6 pt-14 pb-6">
        <h1 className="text-white text-2xl font-bold">My Trips</h1>
      </div>
      <div className="flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🗺️</div>
          <p className="text-gray-400 text-sm">Loading your trips…</p>
        </div>
      </div>
    </div>
  )
}
