import { redirect } from "next/navigation";

export default function PublicTemplateNewRedirect() {
  redirect("/app/templates/new");
}
