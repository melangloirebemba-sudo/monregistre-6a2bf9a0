import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LifeBuoy, MessageCircle, Mail, ChevronDown, Copy, Check } from "lucide-react";
import { profilQueryOptions, planCapabilitiesQO } from "@/lib/queries/profil";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — MonRegistre" },
      { name: "description", content: "Contactez l'équipe MonRegistre par WhatsApp ou e-mail, et consultez la FAQ." },
    ],
  }),
  component: SupportPage,
});

const WHATSAPP_NUMBER = "242069626540";
const SUPPORT_EMAIL = "support@monregistre.app";

const PLAN_LABEL: Record<"gratuit" | "lite" | "premium", string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

const FAQ_GRATUIT: { q: string; a: string }[] = [
  {
    q: "Combien d'écoles puis-je créer avec le plan Gratuit ?",
    a: "Le plan Gratuit permet de gérer 1 seule école. Pour en gérer plusieurs, passez au plan Lite (2 écoles) ou Premium (illimité).",
  },
  {
    q: "Combien de classes puis-je créer par école ?",
    a: "1 classe par école sur le plan Gratuit. Le plan Lite permet 2 classes par école, et le Premium en autorise un nombre illimité.",
  },
  {
    q: "Y a-t-il une limite d'élèves ?",
    a: "Oui, 25 élèves maximum au total sur le plan Gratuit. Les plans Lite et Premium n'imposent aucune limite d'élèves.",
  },
  {
    q: "Puis-je exporter les bulletins en PDF ?",
    a: "Non, l'export PDF des bulletins et des rapports de classe est réservé aux plans Lite et Premium.",
  },
  {
    q: "Ai-je accès aux rapports détaillés ?",
    a: "Les rapports avancés (moyennes, distribution, classements top/flop) et le suivi de progression sont disponibles à partir du plan Lite.",
  },
  {
    q: "Comment passer à un plan supérieur ?",
    a: "Contactez-nous par WhatsApp ou e-mail depuis cette page. Nous activons votre nouveau plan directement sur votre compte.",
  },
];

function buildWhatsAppMessage(ecole: string, plan: string) {
  const lines = [
    "Bonjour, je souhaite obtenir de l'aide concernant MonRegistre.",
    "",
    `École : ${ecole || "(non renseignée)"}`,
    `Plan actuel : ${plan}`,
  ];
  return lines.join("\n");
}

function SupportPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());

  const ecoleNom = profil?.etablissement?.trim() ?? "";
  const planLabel = caps ? PLAN_LABEL[caps.plan] : "Gratuit";
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    buildWhatsAppMessage(ecoleNom, planLabel),
  )}`;
  const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "Support MonRegistre",
  )}&body=${encodeURIComponent(buildWhatsAppMessage(ecoleNom, planLabel))}`;

  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      toast.success("Adresse e-mail copiée");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Aide</div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold text-foreground">
          <LifeBuoy className="h-7 w-7 text-teal" aria-hidden="true" />
          Support
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une question ? Contactez-nous directement — nous répondons rapidement.
        </p>
      </header>

      {/* Contact channels */}
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Canaux de contact">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="card-elevated flex items-start gap-3 p-4 transition-colors hover:bg-cream-deep/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-semibold text-foreground">WhatsApp</span>
            <span className="block text-xs text-muted-foreground">
              Message pré-rempli avec votre école et plan
            </span>
            <span className="mt-1 block truncate text-xs text-teal">+242 06 962 65 40</span>
          </span>
        </a>

        <div className="card-elevated flex items-start gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/20 text-ink">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-semibold text-foreground">E-mail</div>
            <div className="text-xs text-muted-foreground">Réponse sous 24–48 h</div>
            <div className="mt-1 flex items-center gap-1.5">
              <a
                href={mailHref}
                className="truncate text-xs text-teal underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                aria-label="Copier l'adresse e-mail"
                className="rounded-md p-1 text-muted-foreground hover:bg-cream-deep/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Current context recap */}
      {caps && (
        <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-xs text-ink/80">
          <p>
            Votre message inclura automatiquement :
            <span className="ml-1">
              école « <strong>{ecoleNom || "non renseignée"}</strong> », plan <strong>{planLabel}</strong>.
            </span>
          </p>
        </div>
      )}

      {/* FAQ */}
      <section className="mt-8" aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-display text-lg font-semibold text-foreground">
          Limitations du plan Gratuit — FAQ
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ce que vous pouvez faire avec le plan Gratuit et ce qui nécessite un plan supérieur.
        </p>
        <ul className="mt-3 space-y-2">
          {FAQ_GRATUIT.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card-elevated overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-inset"
      >
        <span className="font-display text-sm font-semibold text-foreground">{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-4 py-3 text-sm text-ink/80">{answer}</div>
      )}
    </li>
  );
}
