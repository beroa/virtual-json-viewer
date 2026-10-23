import { DiffKind, InlineDiff, RawDiffLine } from "@/viewer/commons/Diff";
import { Search } from "@/viewer/state";
import { ReactNode, useEffect, useMemo } from "react";
import { uid } from "uid";
import {
  DiffMatch,
  MatchesResult,
  matchLinks,
  matchSearch,
  RenderedText,
  SearchMatchHandler,
} from "../RenderedText";
import { DIFF_TYPE } from "../RenderedText/DiffText";
import { matchJsonSyntax } from "../RenderedText/JsonSyntax";

export type RenderedLinesProps = {
  rawLines?: string[];
  lines?: RawDiffLine[];
  search: Nullable<Search>;
  linkifyUrls: boolean;
  onSearchMatchesUpdate: (searchMatches: SearchMatchHandler[]) => void;
};

export function RenderedLines({
  rawLines,
  lines,
  search,
  linkifyUrls,
  onSearchMatchesUpdate,
}: RenderedLinesProps): ReactNode {
  const displayLines = useMemo<RawDiffLine[]>(
    () =>
      lines ??
      rawLines?.map((text) => ({
        text,
        kind: DiffKind.Same,
        lineNumber: null,
        placeholder: false,
      })) ??
      [],
    [lines, rawLines],
  );
  const showLineNumbers = useMemo(
    () => displayLines.some((line) => line.lineNumber !== null),
    [displayLines],
  );

  // Find all matches in each line
  const lineMatches = useMemo(() => {
    const lineMatches = new LineMatchesFlattener();
    displayLines.forEach((line) => {
      lineMatches.add(findMatches(line, search, linkifyUrls));
    });
    return lineMatches;
  }, [displayLines, search, linkifyUrls]);

  // Register the search matches placeholders in the caller.
  // Handlers will (should?) be already resolved by the time this effect runs.
  useEffect(() => {
    onSearchMatchesUpdate(lineMatches.getFlattenedHandlers());
  }, [lineMatches]);

  // Resolve search matches handlers when they are rendered
  function resolveLineHandlers(
    lineIndex: number,
    handlers: SearchMatchHandler[] | undefined,
  ) {
    if (!handlers) return;
    lineMatches.resolveLineHandlers(lineIndex, handlers);
  }

  return displayLines.map((line, lineIndex) => (
    <div key={lineIndex} className={resolveRowClassName(line)}>
      {showLineNumbers && (
        <span className="text-viewer-foreground/45 w-10 shrink-0 pr-3 text-right select-none">
          {line.lineNumber ?? ""}
        </span>
      )}

      <span className="min-w-0 flex-1 overflow-hidden leading-6 break-all whitespace-pre-wrap">
        <RenderedText
          text={line.placeholder ? " " : line.text}
          matches={lineMatches.get(lineIndex)}
          ref={(ref) => resolveLineHandlers(lineIndex, ref?.searchMatches)}
        />
      </span>
    </div>
  ));
}

function resolveRowClassName(line: RawDiffLine): string {
  if (line.placeholder) {
    return "flex min-h-6 bg-white/[0.03] bg-[linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.05)_6px,rgba(255,255,255,0.05)_12px)]";
  }

  const base = "flex min-h-6";

  switch (line.kind) {
    case DiffKind.Added:
      return `${base} bg-emerald-500/10`;
    case DiffKind.Removed:
      return `${base} bg-red-500/10`;
    case DiffKind.TypeChanged:
      return `${base} bg-orange-500/10`;
    case DiffKind.Changed:
      return `${base} bg-amber-500/10`;
    default:
      return base;
  }
}

type LineMatches = {
  searchOffset: number;
  matches: MatchesResult;
};

class LineMatchesFlattener {
  private lineMatches: LineMatches[] = [];
  private flatHandlers: SearchMatchHandler[] = [];

  public add(matches: MatchesResult) {
    this.lineMatches.push({ searchOffset: this.flatHandlers.length, matches });

    for (let i = 0; i < matches.searchMatches.length; i++) {
      this.flatHandlers.push(SEARCH_MATCH_HANDLER_PLACEHOLDER);
    }
  }

  public get(lineIndex: number): MatchesResult {
    return this.lineMatches[lineIndex].matches;
  }

  public getFlattenedHandlers(): SearchMatchHandler[] {
    return this.flatHandlers;
  }

  public resolveLineHandlers(
    lineIndex: number,
    handlers: SearchMatchHandler[],
  ) {
    handlers.forEach((handler, matchIndex) => {
      const flatIndex = this.lineMatches[lineIndex].searchOffset + matchIndex;
      this.flatHandlers[flatIndex] = handler;
    });
  }
}

const SEARCH_MATCH_HANDLER_PLACEHOLDER: SearchMatchHandler = {
  setSelected: () => {},
  scrollIntoView: () => {},
};

function findMatches(
  line: RawDiffLine,
  search: Nullable<Search>,
  linkifyUrls: boolean,
): MatchesResult {
  const text = line.text;
  const searchMatches = search?.text
    ? matchSearch(text, search.text, search.caseSensitive)
    : [];

  const linkMatches = linkifyUrls ? matchLinks(text) : [];
  const diffMatches = buildDiffMatches(line.inlineDiffs ?? []);

  return {
    diffMatches,
    searchMatches,
    linkMatches,
    syntaxMatches: matchJsonSyntax(text),
  };
}

function buildDiffMatches(inlineDiffs: InlineDiff[]): DiffMatch[] {
  return inlineDiffs.map((match) => ({
    id: uid(),
    start: match.start,
    end: match.end,
    type: DIFF_TYPE,
    metadata: { kind: match.kind },
  }));
}
