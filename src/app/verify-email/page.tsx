import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";

// Email verification was removed as a sign-in requirement - this route only exists so an
// old bookmarked or emailed verification link doesn't dead-end as a 404.
export default async function VerifyEmailPage() {
  const user = await getCurrentSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
