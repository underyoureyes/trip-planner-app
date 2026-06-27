export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-5 animate-pulse">🗺️</div>
        <p className="text-brand-200 text-sm tracking-wide">Loading…</p>
      </div>
    </div>
  )
}
