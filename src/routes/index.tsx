import { createFileRoute, redirect } from "@tanstack/react-router";

// L'accueil réel vit sous /_authenticated/accueil.
// La racine redirige : la porte auth renverra vers /auth si besoin.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/accueil" });
  },
});
