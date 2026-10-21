import { AppHeader } from "@/components/app/app-header";
import { VerifyBanner } from "@/components/app/verify-banner";
import { requireUser } from "@/lib/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <AppHeader user={{ name: user.name, email: user.email, image: user.image, plan: user.plan }} credits={user.creditsMicros} />
      {!user.emailVerified && <VerifyBanner email={user.email} />}
      {children}
    </div>
  );
}
