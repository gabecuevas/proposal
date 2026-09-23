import { cn } from "@repo/ui/utils";

const STEPS = ["Account", "Verify", "Company", "Team"] as const;

export type OnboardingStep = (typeof STEPS)[number];

type OnboardingProgressProps = {
  active: OnboardingStep;
  className?: string;
};

function stepIndex(step: OnboardingStep): number {
  return STEPS.indexOf(step);
}

export function OnboardingProgress({ active, className }: OnboardingProgressProps) {
  const activeIndex = stepIndex(active);

  return (
    <ol className={cn("flex flex-wrap items-center gap-2 text-xs font-medium", className)}>
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5",
                done && "bg-primary text-primary-foreground",
                current && "border border-primary bg-primary/10 text-primary",
                !done && !current && "border border-border bg-surface text-muted",
              )}
            >
              {done ? "✓" : index + 1}
            </span>
            <span className={cn(current ? "text-foreground" : "text-muted")}>{step}</span>
            {index < STEPS.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
