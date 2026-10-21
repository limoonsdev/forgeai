import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { getSession } from "@/lib/server/session";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const session = await getSession().catch(() => null);
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <Navbar signedIn={Boolean(session)} />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieNotice />
    </div>
  );
}
