import { DiffKind } from "@/viewer/commons/Diff";
import classNames from "classnames";
import { JSX } from "react";
import { Match } from "./Match";

export const DIFF_TYPE = "diff";

export interface DiffMatch extends Match<{ kind: DiffKind }> {
  type: typeof DIFF_TYPE;
}

export type DiffTextProps = Props<{
  kind: DiffKind;
}>;

export function DiffText({ kind, children }: DiffTextProps): JSX.Element {
  return (
    <span className={classNames("rounded-[2px]", resolveDiffClassName(kind))}>
      {children}
    </span>
  );
}

function resolveDiffClassName(kind: DiffKind): string {
  switch (kind) {
    case DiffKind.Added:
      return "bg-emerald-600/45";
    case DiffKind.Removed:
      return "bg-red-600/45";
    case DiffKind.TypeChanged:
      return "bg-orange-600/45";
    case DiffKind.Changed:
      return "bg-amber-600/45";
    default:
      return "";
  }
}
