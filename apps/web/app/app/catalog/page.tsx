import { redirect } from "next/navigation";

export default function CatalogIndexPage() {
  redirect("/app/catalog/products");
}
