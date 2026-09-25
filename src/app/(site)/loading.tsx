// Route-level loading state for the public site (docs/PRD.md §63 — never an
// unexplained blank screen). Mirrors the shape of a typical content page so
// the layout doesn't jump when the real content arrives.
export default function SiteLoading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="skeleton mb-6 h-9 w-48 rounded-[var(--radius-sm)]" />
      <div className="skeleton mb-10 h-5 w-72 rounded-[var(--radius-sm)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="rounded-[var(--radius)] border border-line bg-surface p-3">
            <div className="skeleton mb-3 aspect-4/3 rounded-[var(--radius-sm)]" />
            <div className="skeleton mb-2 h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
