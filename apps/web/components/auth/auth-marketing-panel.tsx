import { SendDoxLogo } from "@/components/brand/senddox-logo";

export function AuthMarketingPanel() {
  return (
    <div className="relative hidden min-h-full flex-col justify-between bg-[#1e3a5f] p-10 text-white lg:flex">
      <SendDoxLogo className="h-8 brightness-0 invert" />
      <div className="max-w-md space-y-4">
        <h2 className="text-3xl font-semibold leading-tight">Send proposals that close faster</h2>
        <p className="text-sm leading-relaxed text-white/80">
          SendDox helps revenue teams create, send, track, and e-sign documents with a workflow your
          buyers actually finish.
        </p>
      </div>
      <p className="text-xs text-white/60">Trusted by modern B2B teams</p>
    </div>
  );
}
