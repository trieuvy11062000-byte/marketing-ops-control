import { redirect } from "next/navigation";

// Demo is no longer a standalone top-level section — it now lives inside
// the In-store workspace (Retail/In-store → Demo/Tasting, POSM, TVC).
export default function DemoRedirect() {
  redirect("/in-store");
}
