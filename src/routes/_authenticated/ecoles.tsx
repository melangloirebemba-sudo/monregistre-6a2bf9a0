import { createFileRoute } from "@tanstack/react-router";
import { School } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/ecoles")({
  head: () => ({ meta: [{ title: "Écoles — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Écoles"
      description="Ajoutez, recherchez et consultez vos écoles. Chaque école regroupera ses classes, ses élèves et ses notes."
      icon={School}
    />
  ),
});
