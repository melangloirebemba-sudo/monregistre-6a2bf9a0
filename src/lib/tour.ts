import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { markTourCompleted } from "@/lib/tour.functions";
import { markTourDemoDone } from "@/lib/demo";

const STEPS: DriveStep[] = [
  {
    element: "[data-tour='nav-accueil']",
    popover: {
      title: "Bienvenue sur MonRegistre",
      description:
        "Voici votre tableau de bord. Retrouvez ici vos écoles, classes, élèves et la synchronisation.",
    },
  },
  {
    element: "[data-tour='nav-ecoles']",
    popover: {
      title: "Vos écoles",
      description: "Créez et gérez les établissements dans lesquels vous enseignez.",
    },
  },
  {
    element: "[data-tour='nav-classes']",
    popover: {
      title: "Vos classes",
      description: "Ajoutez vos classes et cliquez dessus pour voir la liste de vos élèves.",
    },
  },
  {
    element: "[data-tour='nav-eleves']",
    popover: {
      title: "Vos élèves",
      description:
        "Ajoutez vos élèves un par un ou en lot. Les ajouts fonctionnent même hors ligne.",
    },
  },
  {
    element: "[data-tour='nav-notes']",
    popover: {
      title: "Saisie des notes",
      description:
        "Utilisez la saisie rapide pour noter plusieurs élèves à la fois, avec prévisualisation.",
    },
  },
  {
    element: "[data-tour='notifications-bell']",
    popover: {
      title: "Vos notifications",
      description: "Retrouvez ici les rappels, annonces et informations importantes.",
    },
  },
  {
    element: "[data-tour='sync-status']",
    popover: {
      title: "Mode hors ligne",
      description:
        "Vos données sont enregistrées localement puis synchronisées automatiquement dès le retour du réseau.",
    },
  },
];

function existingSteps(): DriveStep[] {
  if (typeof document === "undefined") return STEPS;
  return STEPS.filter((s) => {
    const sel = typeof s.element === "string" ? s.element : null;
    if (!sel) return true;
    return document.querySelector(sel) !== null;
  });
}

/** Lance le tour guidé. Marque le tour comme terminé côté serveur si `persist` = true. */
export function startTour(opts?: { persist?: boolean; onDemo?: boolean }) {
  const steps = existingSteps();
  if (steps.length === 0) return;
  const drv = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "Suivant",
    prevBtnText: "Précédent",
    doneBtnText: "Terminer",
    progressText: "{{current}} / {{total}}",
    steps,
    onDestroyed: () => {
      if (opts?.onDemo) markTourDemoDone();
      if (opts?.persist) {
        void markTourCompleted().catch(() => {});
      }
    },
  });
  drv.drive();
}
