import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

/** For Server Components inside the app: the user, or a redirect to /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
