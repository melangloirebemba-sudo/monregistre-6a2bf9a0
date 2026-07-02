import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Notes"
      description="Saisissez rapidement les notes de vos élèves — devoirs, examens, contrôles — avec coefficients."
      icon={ClipboardList}
    />
  ),
});
