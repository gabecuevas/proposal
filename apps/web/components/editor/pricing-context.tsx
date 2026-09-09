"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultPricingModel } from "@/lib/editor/defaults";
import type { PricingModel } from "@/lib/editor/types";

const PricingContext = createContext<PricingModel>(defaultPricingModel);

export function PricingProvider({
  pricing,
  children,
}: {
  pricing: PricingModel;
  children: ReactNode;
}) {
  return <PricingContext.Provider value={pricing}>{children}</PricingContext.Provider>;
}

export function useDocumentPricing(): PricingModel {
  return useContext(PricingContext);
}
