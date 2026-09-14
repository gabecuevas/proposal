import { notFound } from "next/navigation";
import { MarketingLibraryAdminClient } from "@/components/marketing/marketing-library-admin";
import { isMarketingLibraryAdmin } from "@/lib/marketing/admin";
import { getServerSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

export default async function MarketingLibraryAdminPage() {
  const session = await getServerSession();
  if (!session?.email || !isMarketingLibraryAdmin(session.email)) {
    notFound();
  }

  return (
    <div className="app-theme min-h-0 flex-1 overflow-auto bg-background">
      <MarketingLibraryAdminClient adminEmail={session.email} />
    </div>
  );
}
