import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const Route = createFileRoute("/_authenticated/emploi-du-temps")({
  head: () => ({ meta: [{ title: "Emploi du temps — MonRegistre" }] }),
  component: () => (
    <ComingSoon
      title="Emploi du temps"
      description="Votre semaine type par école et par classe, avec détection des chevauchements."
      icon={CalendarDays}
    />
  ),
});
