import AuthScreen from "@/components/AuthScreen";
import AuthenticatedApp from "@/components/AuthenticatedApp";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  return <AuthenticatedApp loginId={user.loginId} />;
}
