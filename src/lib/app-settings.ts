// Hydrate les réglages globaux (numéro WhatsApp, email support) depuis la
// table publique `app_settings`. Appelé au montage du root.
import { supabase } from "@/integrations/supabase/client";
import { updateSupportConfig, type SupportConfig } from "@/config/support";

export interface AppSettingsRow {
  id: number;
  whatsapp_number: string;
  whatsapp_display: string;
  support_email: string;
  updated_at: string;
}

export async function fetchAppSettings(): Promise<AppSettingsRow | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.warn("[app-settings] fetch failed:", error.message);
    return null;
  }
  return data as AppSettingsRow | null;
}

export function applyAppSettings(row: AppSettingsRow | null) {
  if (!row) return;
  const patch: Partial<SupportConfig> = {
    whatsappNumber: row.whatsapp_number,
    whatsappDisplay: row.whatsapp_display,
    supportEmail: row.support_email,
  };
  updateSupportConfig(patch);
}

export async function hydrateAppSettings() {
  const row = await fetchAppSettings();
  applyAppSettings(row);
}
