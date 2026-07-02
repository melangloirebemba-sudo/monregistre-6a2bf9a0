import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Classes"
      description="Créez vos classes, rattachez-les à une école et suivez leurs effectifs."
      icon={GraduationCap}
    />
  ),
});
