"use client";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  className?: string;
  readonly?: boolean;
  size?: "sm" | "md";
};

const sizeClasses: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  className,
  readonly = false,
  size = "md",
}: StarRatingProps) {
  const isInteractive = !readonly && Boolean(onChange);

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      aria-label={`Avaliação atual: ${value} de 5`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const star = (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              sizeClasses[size],
              starValue <= value
                ? "fill-[var(--brand-yellow)] text-[var(--brand-yellow)]"
                : "fill-white text-slate-300",
            )}
          >
            <path
              stroke="currentColor"
              strokeWidth="1.5"
              d="M12 3.75l2.55 5.16 5.7.83-4.13 4.03.97 5.68L12 16.77l-5.09 2.68.97-5.68-4.13-4.03 5.7-.83L12 3.75z"
            />
          </svg>
        );

        if (!isInteractive) {
          return <span key={starValue}>{star}</span>;
        }

        return (
          <button
            key={starValue}
            type="button"
            className="rounded-md p-0.5 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-yellow)]"
            onClick={() => onChange?.(starValue)}
            aria-label={`Definir nota ${starValue}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
