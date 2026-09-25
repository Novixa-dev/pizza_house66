import { destroySession } from "@/lib/auth";
import { redirectSameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

// POST only: a logout reachable by GET can be triggered by any image tag on
// any page, which is a small but needless way to sign staff out.
export async function POST() {
  await destroySession();
  return redirectSameOrigin("/admin/login");
}
