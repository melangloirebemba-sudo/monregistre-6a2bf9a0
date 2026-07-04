/**
 * Classes partagées pour l'ossature des modales (`Dialog` et `AlertDialog`).
 *
 * Centralise la largeur, les marges de sécurité, la hauteur max et le
 * comportement de scroll afin que toutes les modales aient un rendu
 * cohérent sur mobile, tablette et desktop.
 *
 * - Largeur : `calc(100vw - 2rem)` (1 rem de marge de chaque côté) plafonnée
 *   à la taille max (`max-w-*` peut être surchargée via `className`).
 * - Hauteur : plafonnée à `calc(100dvh - 2rem)` avec scroll vertical interne
 *   pour éviter tout débordement en cas de contenu long.
 * - Position : centrée via `translate` à partir du coin haut-gauche à 50 %.
 */
export const modalShellClasses =
  "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
