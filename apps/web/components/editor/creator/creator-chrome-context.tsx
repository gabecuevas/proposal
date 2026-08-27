"use client";

import { createContext, useContext } from "react";

type CreatorChrome = {
  documentId?: string;
  templateId?: string;
};

const CreatorChromeContext = createContext<CreatorChrome>({});

export function CreatorChromeProvider({
  documentId,
  templateId,
  children,
}: CreatorChrome & { children: React.ReactNode }) {
  return (
    <CreatorChromeContext.Provider value={{ documentId, templateId }}>
      {children}
    </CreatorChromeContext.Provider>
  );
}

export function useCreatorChrome(): CreatorChrome {
  return useContext(CreatorChromeContext);
}
