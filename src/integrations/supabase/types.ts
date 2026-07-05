export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          date: string
          eleve_id: string
          id: string
          justifiee: boolean
          motif: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          eleve_id: string
          id?: string
          justifiee?: boolean
          motif?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          eleve_id?: string
          id?: string
          justifiee?: boolean
          motif?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_password_changes: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          source: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          source?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          source?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      annees_scolaires: {
        Row: {
          created_at: string
          date_debut: string | null
          date_fin: string | null
          id: string
          libelle: string
          notes: string | null
          statut: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          libelle: string
          notes?: string | null
          statut?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          libelle?: string
          notes?: string | null
          statut?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          support_email: string
          updated_at: string
          whatsapp_display: string
          whatsapp_number: string
        }
        Insert: {
          id?: number
          support_email?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Update: {
          id?: number
          support_email?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          annee_scolaire: string | null
          chef_id: string | null
          code: string
          created_at: string
          ecole_id: string
          effectif: number
          id: string
          matiere: string | null
          nom: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annee_scolaire?: string | null
          chef_id?: string | null
          code: string
          created_at?: string
          ecole_id: string
          effectif?: number
          id?: string
          matiere?: string | null
          nom: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annee_scolaire?: string | null
          chef_id?: string | null
          code?: string
          created_at?: string
          ecole_id?: string
          effectif?: number
          id?: string
          matiere?: string | null
          nom?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_chef_id_fkey"
            columns: ["chef_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      creneaux: {
        Row: {
          classe_id: string
          created_at: string
          ecole_id: string
          heure_debut: string
          heure_fin: string
          id: string
          jour_semaine: number
          matiere: string | null
          salle: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          ecole_id: string
          heure_debut: string
          heure_fin: string
          id?: string
          jour_semaine: number
          matiere?: string | null
          salle?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          ecole_id?: string
          heure_debut?: string
          heure_fin?: string
          id?: string
          jour_semaine?: number
          matiere?: string | null
          salle?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creneaux_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creneaux_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      ecoles: {
        Row: {
          adresse: string | null
          created_at: string
          directeur_etudes: string | null
          id: string
          nom: string
          numero: string | null
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          directeur_etudes?: string | null
          id?: string
          nom: string
          numero?: string | null
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          directeur_etudes?: string | null
          id?: string
          nom?: string
          numero?: string | null
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eleves: {
        Row: {
          adresse: string | null
          classe_id: string
          created_at: string
          ecole_id: string
          id: string
          nom: string
          numero_eleve: string | null
          prenom: string
          sexe: string | null
          tuteur_nom: string | null
          tuteur_numero: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          classe_id: string
          created_at?: string
          ecole_id: string
          id?: string
          nom: string
          numero_eleve?: string | null
          prenom: string
          sexe?: string | null
          tuteur_nom?: string | null
          tuteur_numero?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          classe_id?: string
          created_at?: string
          ecole_id?: string
          id?: string
          nom?: string
          numero_eleve?: string | null
          prenom?: string
          sexe?: string | null
          tuteur_nom?: string | null
          tuteur_numero?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eleves_classe_ecole_fkey"
            columns: ["classe_id", "ecole_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "ecole_id"]
          },
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          coefficient: number
          created_at: string
          date: string
          ecole_id: string
          eleve_id: string
          id: string
          libelle: string
          matiere: string | null
          periode_id: string | null
          sequence_id: string | null
          updated_at: string
          user_id: string
          valeur: number
        }
        Insert: {
          coefficient?: number
          created_at?: string
          date?: string
          ecole_id: string
          eleve_id: string
          id?: string
          libelle: string
          matiere?: string | null
          periode_id?: string | null
          sequence_id?: string | null
          updated_at?: string
          user_id: string
          valeur: number
        }
        Update: {
          coefficient?: number
          created_at?: string
          date?: string
          ecole_id?: string
          eleve_id?: string
          id?: string
          libelle?: string
          matiere?: string | null
          periode_id?: string | null
          sequence_id?: string | null
          updated_at?: string
          user_id?: string
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "notes_ecole_id_fkey"
            columns: ["ecole_id"]
            isOneToOne: false
            referencedRelation: "ecoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_periode_id_fkey"
            columns: ["periode_id"]
            isOneToOne: false
            referencedRelation: "periodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_sequence_fk"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences_programme"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          created_at: string
          created_by: string | null
          devise: string
          id: string
          montant: number
          moyen_paiement: string
          note: string | null
          numero_recu: string | null
          paye_le: string
          pdf_path: string | null
          periode: Database["public"]["Enums"]["plan_periode"]
          plan: Database["public"]["Enums"]["app_plan"]
          plan_activation_id: string | null
          plan_expires_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          devise?: string
          id?: string
          montant?: number
          moyen_paiement?: string
          note?: string | null
          numero_recu?: string | null
          paye_le?: string
          pdf_path?: string | null
          periode: Database["public"]["Enums"]["plan_periode"]
          plan: Database["public"]["Enums"]["app_plan"]
          plan_activation_id?: string | null
          plan_expires_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          devise?: string
          id?: string
          montant?: number
          moyen_paiement?: string
          note?: string | null
          numero_recu?: string | null
          paye_le?: string
          pdf_path?: string | null
          periode?: Database["public"]["Enums"]["plan_periode"]
          plan?: Database["public"]["Enums"]["app_plan"]
          plan_activation_id?: string | null
          plan_expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_plan_activation_id_fkey"
            columns: ["plan_activation_id"]
            isOneToOne: true
            referencedRelation: "plan_activations"
            referencedColumns: ["id"]
          },
        ]
      }
      periodes: {
        Row: {
          active: boolean
          annee_scolaire: string
          created_at: string
          id: string
          label: string
          ordre: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          annee_scolaire: string
          created_at?: string
          id?: string
          label: string
          ordre?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          annee_scolaire?: string
          created_at?: string
          id?: string
          label?: string
          ordre?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_activations: {
        Row: {
          activated_by: string | null
          activated_by_email: string | null
          created_at: string
          id: string
          note: string | null
          periode: Database["public"]["Enums"]["plan_periode"] | null
          plan: Database["public"]["Enums"]["app_plan"]
          plan_expires_at: string | null
          plan_started_at: string
          user_id: string
        }
        Insert: {
          activated_by?: string | null
          activated_by_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          periode?: Database["public"]["Enums"]["plan_periode"] | null
          plan: Database["public"]["Enums"]["app_plan"]
          plan_expires_at?: string | null
          plan_started_at?: string
          user_id: string
        }
        Update: {
          activated_by?: string | null
          activated_by_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          periode?: Database["public"]["Enums"]["plan_periode"] | null
          plan?: Database["public"]["Enums"]["app_plan"]
          plan_expires_at?: string | null
          plan_started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          bulletins_pdf: boolean
          max_classes_par_ecole: number
          max_ecoles: number
          max_eleves: number
          plan: Database["public"]["Enums"]["app_plan"]
          progression: boolean
          rapports: boolean
          updated_at: string
        }
        Insert: {
          bulletins_pdf?: boolean
          max_classes_par_ecole: number
          max_ecoles: number
          max_eleves: number
          plan: Database["public"]["Enums"]["app_plan"]
          progression?: boolean
          rapports?: boolean
          updated_at?: string
        }
        Update: {
          bulletins_pdf?: boolean
          max_classes_par_ecole?: number
          max_ecoles?: number
          max_eleves?: number
          plan?: Database["public"]["Enums"]["app_plan"]
          progression?: boolean
          rapports?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      plan_prices: {
        Row: {
          devise: string
          montant: number
          periode: Database["public"]["Enums"]["plan_periode"]
          plan: Database["public"]["Enums"]["app_plan"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          devise?: string
          montant?: number
          periode: Database["public"]["Enums"]["plan_periode"]
          plan: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          devise?: string
          montant?: number
          periode?: Database["public"]["Enums"]["plan_periode"]
          plan?: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profils_enseignant: {
        Row: {
          annee_active: string
          created_at: string
          echelle_notation: number
          email: string | null
          etablissement: string | null
          id: string
          initiales: string
          matiere_principale: string | null
          nom_affiche: string
          nom_famille: string | null
          plan: Database["public"]["Enums"]["app_plan"]
          plan_expires_at: string | null
          plan_periode: Database["public"]["Enums"]["plan_periode"] | null
          plan_started_at: string | null
          prenom: string | null
          statut: Database["public"]["Enums"]["user_statut"]
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annee_active?: string
          created_at?: string
          echelle_notation?: number
          email?: string | null
          etablissement?: string | null
          id?: string
          initiales?: string
          matiere_principale?: string | null
          nom_affiche?: string
          nom_famille?: string | null
          plan?: Database["public"]["Enums"]["app_plan"]
          plan_expires_at?: string | null
          plan_periode?: Database["public"]["Enums"]["plan_periode"] | null
          plan_started_at?: string | null
          prenom?: string | null
          statut?: Database["public"]["Enums"]["user_statut"]
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annee_active?: string
          created_at?: string
          echelle_notation?: number
          email?: string | null
          etablissement?: string | null
          id?: string
          initiales?: string
          matiere_principale?: string | null
          nom_affiche?: string
          nom_famille?: string | null
          plan?: Database["public"]["Enums"]["app_plan"]
          plan_expires_at?: string | null
          plan_periode?: Database["public"]["Enums"]["plan_periode"] | null
          plan_started_at?: string | null
          prenom?: string | null
          statut?: Database["public"]["Enums"]["user_statut"]
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sequences_programme: {
        Row: {
          classe_id: string
          created_at: string
          date_traitee: string | null
          description: string | null
          id: string
          notes_libres: string | null
          ordre: number
          periode_id: string | null
          semaine_prevue: number | null
          statut: string
          titre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          date_traitee?: string | null
          description?: string | null
          id?: string
          notes_libres?: string | null
          ordre?: number
          periode_id?: string | null
          semaine_prevue?: number | null
          statut?: string
          titre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          date_traitee?: string | null
          description?: string | null
          id?: string
          notes_libres?: string | null
          ordre?: number
          periode_id?: string | null
          semaine_prevue?: number | null
          statut?: string
          titre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_programme_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_programme_periode_id_fkey"
            columns: ["periode_id"]
            isOneToOne: false
            referencedRelation: "periodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_plan: {
        Args: {
          _periode: Database["public"]["Enums"]["plan_periode"]
          _plan: Database["public"]["Enums"]["app_plan"]
          _user_id: string
        }
        Returns: undefined
      }
      expire_plans: { Args: never; Returns: number }
      get_user_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_plan"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      plan_periode_days: {
        Args: { _periode: Database["public"]["Enums"]["plan_periode"] }
        Returns: number
      }
    }
    Enums: {
      app_plan: "gratuit" | "lite" | "premium"
      app_role: "admin" | "user"
      plan_periode: "mensuelle" | "trimestrielle" | "annuelle"
      user_statut: "actif" | "suspendu"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_plan: ["gratuit", "lite", "premium"],
      app_role: ["admin", "user"],
      plan_periode: ["mensuelle", "trimestrielle", "annuelle"],
      user_statut: ["actif", "suspendu"],
    },
  },
} as const
