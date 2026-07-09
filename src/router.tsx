import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Les données restent « fraîches » 60 s : navigation instantanée
        // sur les pages déjà visitées, sans refetch systématique.
        staleTime: 60_000,
        // Conserve les données en cache 10 min après démontage
        // (retour arrière ⇒ pas de spinner).
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  // Hors ligne : le cache de lecture (classes, élèves, notes, absences, EDT...)
  // est persisté dans IndexedDB, pour que l'app affiche les dernières données
  // connues même après un redémarrage complet sans connexion.
  if (typeof window !== "undefined") {
    const persister = createAsyncStoragePersister({
      key: "monregistre-query-cache",
      storage: {
        getItem: (key: string) => get(key),
        setItem: (key: string, value: string) => set(key, value),
        removeItem: (key: string) => del(key),
      },
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 jours de cache offline
      dehydrateOptions: {
        // Ne persiste que les requêtes résolues avec succès (pas les erreurs/pending).
        shouldDehydrateQuery: (query) => query.state.status === "success",
      },
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Précharge la route au survol / focus du lien pour une nav quasi-instantanée.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // TanStack Query gère la fraîcheur des données ; on laisse le routeur
    // déclencher `ensureQueryData` sans court-circuiter le cache Query.
    defaultPreloadStaleTime: 0,
    // Garde les données de la page précédente visibles pendant la transition
    // au lieu d'afficher un fallback vide.
    defaultPendingMs: 300,
    defaultPendingMinMs: 150,
  });

  return router;
};

