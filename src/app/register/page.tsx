import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : session.role === "STAFF" ? "/staff" : "/");
  return <AuthForm mode="register" />;
}
