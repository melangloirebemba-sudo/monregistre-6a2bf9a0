import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/rapports")({
  head: () => ({ meta: [{ title: "Rapports — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Rapports"
      description="Moyennes, classements, statistiques et génération de bulletins PDF."
      icon={BarChart3}
    />
  ),
});
