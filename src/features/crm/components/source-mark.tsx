import {
  CalendarDotsIcon,
  DotsThreeCircleIcon,
  FacebookLogoIcon,
  GlobeSimpleIcon,
  HandshakeIcon,
  InstagramLogoIcon,
  PhoneIcon,
  TargetIcon,
  WhatsappLogoIcon,
  type Icon,
  type IconWeight,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { BrandIcon } from "@/components/ui/brand-icon";
import { sourceHues } from "../labels";
import type { OpportunitySource } from "../summary";

const sourceIcons = {
  whatsapp: WhatsappLogoIcon,
  indicacao: HandshakeIcon,
  site: GlobeSimpleIcon,
  instagram: InstagramLogoIcon,
  facebook: FacebookLogoIcon,
  evento: CalendarDotsIcon,
  prospeccao: TargetIcon,
  telefone: PhoneIcon,
  outro: DotsThreeCircleIcon,
} satisfies Record<Exclude<OpportunitySource, "google">, Icon>;

const brandSources = new Set<OpportunitySource>([
  "whatsapp",
  "instagram",
  "facebook",
]);

export function SourceMark({
  source,
  weight,
  className,
}: {
  source: OpportunitySource;
  weight?: IconWeight;
  className?: string;
}) {
  if (source === "google") {
    return <BrandIcon name="google-icon-logo" color className={className} />;
  }

  const Glyph = sourceIcons[source];
  return (
    <Glyph
      aria-hidden="true"
      className={className}
      weight={weight ?? (brandSources.has(source) ? "fill" : "bold")}
      style={{ color: sourceHues[source] } as CSSProperties}
    />
  );
}
