"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";

interface Ctx {
  input: MatchInput | null;
  result: MatchResult | null;
  setProject: (input: MatchInput, result: MatchResult | null) => void;
}
const ProjectCtx = createContext<Ctx | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ input: MatchInput | null; result: MatchResult | null }>({
    input: null,
    result: null,
  });
  const setProject = useCallback(
    (input: MatchInput, result: MatchResult | null) => setState({ input, result }),
    []
  );
  return <ProjectCtx.Provider value={{ ...state, setProject }}>{children}</ProjectCtx.Provider>;
}

export function useProject(): Ctx {
  const c = useContext(ProjectCtx);
  if (!c) throw new Error("useProject must be used within ProjectProvider");
  return c;
}
