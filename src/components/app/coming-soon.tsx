import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  eta?: string;
}

export function ComingSoon({ title, description, icon: Icon, eta = "Bientôt" }: Props) {
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {eta}
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          {title}
        </h1>
      </div>
      <div className="card-elevated flex flex-col items-center gap-4 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-ink">
          <Icon className="h-6 w-6" />
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        <div className="inline-flex items-center rounded-full bg-teal/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-teal">
          En cours de construction
        </div>
      </div>
    </div>
  );
}
