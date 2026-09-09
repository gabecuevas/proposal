import { cn } from "@repo/ui/utils";

type SendDoxLogoProps = {
  className?: string;
  /** Accessible name; set empty string when a parent already labels the control. */
  title?: string;
};

/**
 * Brand wordmark (`>_senddox`). Height-driven sizing keeps aspect ratio at any UI size.
 */
export function SendDoxLogo({ className, title = "SendDox" }: SendDoxLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand mark scales via CSS height; next/image is unnecessary here
    <img
      src="/brand/senddox-logo.svg"
      alt={title}
      draggable={false}
      className={cn("block h-[21.6px] w-auto select-none object-contain object-left", className)}
    />
  );
}
