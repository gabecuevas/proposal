"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { useNewDocumentWorkflow } from "@/components/documents/new-document-workflow-context";
import { rememberWorkflowStep } from "@/lib/documents/workflow-resume";

const STEPS = [
  { id: 1, label: "Add Contact" },
  { id: 2, label: "Edit Document" },
  { id: 3, label: "Review & Send" },
] as const;

type StepStatus = "complete" | "current" | "upcoming";

function stepStatus(stepId: number, currentStep: number): StepStatus {
  if (stepId < currentStep) {
    return "complete";
  }
  if (stepId === currentStep) {
    return "current";
  }
  return "upcoming";
}

/**
 * Centered horizontal progress wizard (numbered circles + labels).
 * Used under the File nav during Library → Use flows.
 */
export function UseTemplateStepWizard({
  currentStep,
  onSelectStep,
  className,
}: {
  currentStep: 1 | 2 | 3;
  onSelectStep?: (step: 1 | 2 | 3) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn("flex w-full justify-center px-4 py-1", className)}
      aria-label="Use template steps"
    >
      <ol className="flex w-full max-w-3xl items-start justify-between">
        {STEPS.map((step, index) => {
          const status = stepStatus(step.id, currentStep);
          const clickable =
            Boolean(onSelectStep) && (status === "complete" || status === "current" || step.id === 3);
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center text-center">
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+12px)] right-[calc(-50%+12px)] top-[11px] h-px",
                    step.id < currentStep ? "bg-[#0f2744]" : "bg-[#d7dee8]",
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!clickable}
                aria-current={status === "current" ? "step" : undefined}
                onClick={() => onSelectStep?.(step.id)}
                className={cn(
                  "relative z-[1] flex flex-col items-center gap-0.5 disabled:cursor-default",
                  clickable && status !== "current" ? "cursor-pointer" : null,
                )}
              >
                <span
                  className={cn(
                    "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold",
                    status === "current" && "bg-[#0f2744] text-white",
                    status === "complete" && "bg-[#0f2744] text-white",
                    status === "upcoming" && "bg-[#e8edf3] text-[#94a3b8]",
                  )}
                >
                  {status === "complete" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 12.5l5 5L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-[7rem] text-[9px] font-semibold uppercase leading-none tracking-[0.05em]",
                    status === "upcoming" ? "text-[#94a3b8]" : "text-[#0f2744]",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function UseTemplateWizardChromeInner({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const { openWorkflow } = useNewDocumentWorkflow();
  const inWorkflow = searchParams.get("afterUse") === "1";
  useEffect(() => {
    if (inWorkflow && documentId) {
      rememberWorkflowStep(documentId, "edit");
    }
  }, [documentId, inWorkflow]);
  if (!inWorkflow) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-[#dadce0] bg-white">
      <UseTemplateStepWizard
        currentStep={2}
        onSelectStep={(step) => {
          if (step === 3) {
            openWorkflow({ documentId, initialStep: 4 });
          }
        }}
      />
    </div>
  );
}

/**
 * Shown on the document editor after Library → Use creates a draft and
 * routes here for Edit Document. Continues into Review & Send.
 */
export function UseTemplateWizardChrome({ documentId }: { documentId: string }) {
  return (
    <Suspense fallback={null}>
      <UseTemplateWizardChromeInner documentId={documentId} />
    </Suspense>
  );
}
