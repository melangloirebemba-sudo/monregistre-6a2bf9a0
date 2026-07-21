import { supabase } from "@/integrations/supabase/client";
import { seedDemoData } from "@/lib/demo-seed.functions";

const FLAG = "mr-demo-mode";
const TOUR_DEMO_DONE = "mr-tour-demo-done";

export function isDemoMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(FLAG) === "1";
}

export function setDemoMode(active: boolean) {
  if (typeof localStorage === "undefined") return;
  if (active) localStorage.setItem(FLAG, "1");
  else localStorage.removeItem(FLAG);
}

export function markTourDemoDone() {
  if (typeof localStorage !== "undefined") localStorage.setItem(TOUR_DEMO_DONE, "1");
}
export function isTourDemoDone(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(TOUR_DEMO_DONE) === "1";
}

/** Lance une session démo isolée via un utilisateur anonyme + données pré-remplies. */
export async function startDemo(): Promise<void> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Impossible de démarrer la démo");
  setDemoMode(true);
  try {
    await seedDemoData();
  } catch (e) {
    // Non bloquant : l'utilisateur peut créer ses propres données.
    console.warn("Seed démo échoué:", e);
  }
}

/** Termine la session démo, purge la session locale et invite à créer un compte. */
export async function endDemo(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* noop */
  }
  setDemoMode(false);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TOUR_DEMO_DONE);
  }
}
