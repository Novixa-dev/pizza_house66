// Loading state for the staff area.
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="skeleton h-9 w-56 rounded-[var(--radius-sm)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="skeleton h-24 rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-[var(--radius)]" />
    </div>
  );
}
