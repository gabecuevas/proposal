import { redirect } from "next/navigation";

export default function SettingsSecurityPage() {
  redirect("/app/settings/profile#password");
}
