import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, roleCanAccessAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !roleCanAccessAdmin(session.role)) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <nav className="flex gap-4 text-sm font-semibold">
          <Link href="/admin/orders">Orders</Link>
          <Link href="/kitchen">Kitchen</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>
            {session.name} ({session.role})
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="rounded border border-border px-3 py-1 hover:bg-background">
              Log Out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
