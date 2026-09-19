export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold">Pizza House Staff Login</h1>
      <form action="/api/auth/login" method="post" className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/admin/orders"} />
        <input
          required
          type="email"
          name="email"
          placeholder="Email"
          className="w-full rounded-lg border border-border bg-surface p-3"
        />
        <input
          required
          type="password"
          name="password"
          placeholder="Password"
          className="w-full rounded-lg border border-border bg-surface p-3"
        />
        {error && (
          <p className="rounded-lg bg-brand/10 p-3 text-sm font-semibold text-brand">
            {error === "rate_limited" ? "Too many attempts. Try again shortly." : "Invalid credentials."}
          </p>
        )}
        <button type="submit" className="w-full rounded-lg bg-brand px-6 py-3 font-bold text-brand-contrast">
          Sign In
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        Demo accounts: owner@pizzahouse.local / kitchen@pizzahouse.local
      </p>
    </div>
  );
}
