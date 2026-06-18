import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  withLink?: boolean;
  className?: string;
  compact?: boolean;
};

export function Logo({ withLink = true, className, compact = false }: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/img/icone_svg.svg"
        alt="Autecno ícone"
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        priority
      />
      {!compact && (
        <Image
          src="/img/logo_svg.svg"
          alt="Autecno"
          width={130}
          height={34}
          priority
          style={{ height: "auto" }}
        />
      )}
    </div>
  );

  if (!withLink) {
    return content;
  }

  return <Link href="/">{content}</Link>;
}
