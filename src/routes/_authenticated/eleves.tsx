import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/eleves")({
  head: () => ({ meta: [{ title: "Élèves — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Élèves"
      description="Recherchez un élève, consultez son bulletin et sa moyenne pondérée."
      icon={Users}
    />
  ),
});
