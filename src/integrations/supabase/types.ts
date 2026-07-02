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
      classes: {
        Row: {
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
          classe_id: string
          created_at: string
          ecole_id: string
          id: string
          nom: string
          prenom: string
          sexe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          ecole_id: string
          id?: string
          nom: string
          prenom: string
          sexe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          ecole_id?: string
          id?: string
          nom?: string
          prenom?: string
          sexe?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      profils_enseignant: {
        Row: {
          annee_active: string
          created_at: string
          echelle_notation: number
          id: string
          initiales: string
          nom_affiche: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annee_active?: string
          created_at?: string
          echelle_notation?: number
          id?: string
          initiales?: string
          nom_affiche?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annee_active?: string
          created_at?: string
          echelle_notation?: number
          id?: string
          initiales?: string
          nom_affiche?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
