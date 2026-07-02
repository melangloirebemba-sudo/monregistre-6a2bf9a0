import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/progression")({
  head: () => ({ meta: [{ title: "Progression — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Progression pédagogique"
      description="Planning de vos séquences par trimestre et tableau de bord multi-classes."
      icon={BookOpen}
    />
  ),
});
