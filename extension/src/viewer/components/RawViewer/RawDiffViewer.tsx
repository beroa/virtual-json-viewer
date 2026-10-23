import { DiffKind, InlineDiff, RawDiffLine } from "@/viewer/commons/Diff";
import {
  ViewerEventType,
  shouldHandleViewerEvent,
} from "@/viewer/commons/EventBus";
import { Search, SearchNavigation, SettingsContext } from "@/viewer/state";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { uid } from "uid";
import {
  DiffMatch,
  MatchesResult,
  RenderedText,
  SearchMatchHandler,
  matchLinks,
  matchSearch,
} from "../RenderedText";
import { DIFF_TYPE } from "../RenderedText/DiffText";
import { matchJsonSyntax } from "../RenderedText/JsonSyntax";
import { SearchMatchNavigator } from "./SearchMatchNavigator";

export type RawDiffViewerProps = Props<{
  leftLines: RawDiffLine[];
  rightLines: RawDiffLine[];
  search: Search;
  isLargeJsonLeft: boolean;
  isLargeJsonRight: boolean;
  setLeftSearchNavigation: Dispatch<SetStateAction<SearchNavigation>>;
  setRightSearchNavigation: Dispatch<SetStateAction<SearchNavigation>>;
  activePane: "left" | "right";
  setActivePane: (pane: "left" | "right") => void;
  searchStartingIndex: number;
  leftLabel: string;
  rightLabel: string;
}>;

export function RawDiffViewer({
  leftLines,
  rightLines,
  search,
  isLargeJsonLeft,
  isLargeJsonRight,
  setLeftSearchNavigation,
  setRightSearchNavigation,
  activePane,
  setActivePane,
  searchStartingIndex,
  leftLabel,
  rightLabel,
  className,
}: RawDiffViewerProps): JSX.Element {
  const linkifyUrls = useLinkifyUrls(isLargeJsonLeft || isLargeJsonRight);

  const leftMatches = useMemo(
    () => buildLineMatches(leftLines, search, linkifyUrls),
    [leftLines, search, linkifyUrls],
  );
  const rightMatches = useMemo(
    () => buildLineMatches(rightLines, search, linkifyUrls),
    [rightLines, search, linkifyUrls],
  );

  const leftNavigator = useRef(new SearchMatchNavigator());
  const rightNavigator = useRef(new SearchMatchNavigator());
  leftNavigator.current.observeNavigation(setLeftSearchNavigation);
  rightNavigator.current.observeNavigation(setRightSearchNavigation);

  useEffect(() => {
    leftNavigator.current.reset(
      leftMatches.getFlattenedHandlers(),
      searchStartingIndex,
    );
  }, [leftMatches, searchStartingIndex]);

  useEffect(() => {
    rightNavigator.current.reset(
      rightMatches.getFlattenedHandlers(),
      searchStartingIndex,
    );
  }, [rightMatches, searchStartingIndex]);

  const goToPreviousMatch = useCallback((event: Event) => {
    if (shouldHandleViewerEvent(event, "left")) {
      leftNavigator.current.goToPreviousMatch();
    }
    if (shouldHandleViewerEvent(event, "right")) {
      rightNavigator.current.goToPreviousMatch();
    }
  }, []);
  useEventListener(ViewerEventType.SearchNavigatePrevious, goToPreviousMatch);

  const goToNextMatch = useCallback((event: Event) => {
    if (shouldHandleViewerEvent(event, "left")) {
      leftNavigator.current.goToNextMatch();
    }
    if (shouldHandleViewerEvent(event, "right")) {
      rightNavigator.current.goToNextMatch();
    }
  }, []);
  useEventListener(ViewerEventType.SearchNavigateNext, goToNextMatch);

  return (
    <div className={classNames("relative min-h-0 flex-1", className)}>
      <div className="h-full overflow-auto px-1.5 pb-1.5">
        <div className="bg-viewer-background sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
          <DiffHeader label={leftLabel} active={activePane === "left"} />
          <DiffHeader label={rightLabel} active={activePane === "right"} />
        </div>

        {leftLines.map((leftLine, index) => (
          <DiffRow
            key={index}
            leftLine={leftLine}
            rightLine={rightLines[index]}
            leftMatches={leftMatches}
            rightMatches={rightMatches}
            lineIndex={index}
            setActivePane={setActivePane}
          />
        ))}
      </div>

      <DiffOverviewRuler leftLines={leftLines} rightLines={rightLines} />
    </div>
  );
}

type DiffOverviewRulerProps = {
  leftLines: RawDiffLine[];
  rightLines: RawDiffLine[];
};

function DiffOverviewRuler({
  leftLines,
  rightLines,
}: DiffOverviewRulerProps): JSX.Element {
  const lineCount = Math.max(leftLines.length, rightLines.length);
  const leftRanges = useMemo(() => buildDiffRanges(leftLines), [leftLines]);
  const rightRanges = useMemo(() => buildDiffRanges(rightLines), [rightLines]);

  if (!lineCount || (!leftRanges.length && !rightRanges.length)) {
    return <></>;
  }

  return (
    <div
      aria-hidden="true"
      className="bg-viewer-background/80 pointer-events-none absolute top-8 right-1 bottom-2 z-20 grid w-2 grid-cols-2 gap-px overflow-hidden rounded-sm p-px shadow-sm"
    >
      <DiffOverviewTrack
        className="bg-red-500/90"
        ranges={leftRanges}
        lineCount={lineCount}
      />
      <DiffOverviewTrack
        className="bg-emerald-500/90"
        ranges={rightRanges}
        lineCount={lineCount}
      />
    </div>
  );
}

type DiffRange = {
  start: number;
  end: number;
};

type DiffOverviewTrackProps = {
  className: string;
  ranges: DiffRange[];
  lineCount: number;
};

function DiffOverviewTrack({
  className,
  ranges,
  lineCount,
}: DiffOverviewTrackProps): JSX.Element {
  return (
    <div className="relative">
      {ranges.map(({ start, end }) => (
        <span
          key={start}
          className={classNames("absolute inset-x-0 rounded-sm", className)}
          style={{
            top: `${(start / lineCount) * 100}%`,
            height: `max(3px, ${((end - start) / lineCount) * 100}%)`,
          }}
        />
      ))}
    </div>
  );
}

function buildDiffRanges(lines: RawDiffLine[]): DiffRange[] {
  const ranges: DiffRange[] = [];
  let rangeStart: Nullable<number> = null;

  lines.forEach((line, index) => {
    const isChanged = !line.placeholder && line.kind !== DiffKind.Same;

    if (isChanged && rangeStart === null) {
      rangeStart = index;
    }

    if (!isChanged && rangeStart !== null) {
      ranges.push({ start: rangeStart, end: index });
      rangeStart = null;
    }
  });

  if (rangeStart !== null) {
    ranges.push({ start: rangeStart, end: lines.length });
  }

  return ranges;
}

type DiffHeaderProps = {
  label: string;
  active: boolean;
};

function DiffHeader({ label, active }: DiffHeaderProps): JSX.Element {
  return (
    <header
      className={classNames(
        "bg-toolbar-background text-toolbar-foreground border-toolbar-foreground/20 truncate border-x border-t px-2 py-1 text-sm",
        { "ring-toolbar-foreground/40 ring-1": active },
      )}
    >
      {label}
    </header>
  );
}

type DiffRowProps = {
  leftLine: RawDiffLine;
  rightLine: RawDiffLine;
  leftMatches: LineMatchesFlattener;
  rightMatches: LineMatchesFlattener;
  lineIndex: number;
  setActivePane: (pane: "left" | "right") => void;
};

function DiffRow({
  leftLine,
  rightLine,
  leftMatches,
  rightMatches,
  lineIndex,
  setActivePane,
}: DiffRowProps): JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
      <DiffCell
        line={leftLine}
        matches={leftMatches}
        lineIndex={lineIndex}
        pane="left"
        setActivePane={setActivePane}
      />
      <DiffCell
        line={rightLine}
        matches={rightMatches}
        lineIndex={lineIndex}
        pane="right"
        setActivePane={setActivePane}
      />
    </div>
  );
}

type DiffCellProps = {
  line: RawDiffLine;
  matches: LineMatchesFlattener;
  lineIndex: number;
  pane: "left" | "right";
  setActivePane: (pane: "left" | "right") => void;
};

function DiffCell({
  line,
  matches,
  lineIndex,
  pane,
  setActivePane,
}: DiffCellProps): JSX.Element {
  return (
    <div
      className={resolveRowClassName(line)}
      onMouseDown={() => setActivePane(pane)}
      onFocusCapture={() => setActivePane(pane)}
    >
      <span className="text-viewer-foreground/45 self-start pt-0.5 pr-3 text-right select-none">
        {line.lineNumber ?? ""}
      </span>
      <div className="min-w-0 leading-6 break-all whitespace-pre-wrap">
        <RenderedText
          text={line.placeholder ? " " : line.text}
          matches={matches.get(lineIndex)}
          ref={(ref) =>
            matches.resolveLineHandlers(lineIndex, ref?.searchMatches)
          }
        />
      </div>
    </div>
  );
}

function resolveRowClassName(line: RawDiffLine): string {
  if (line.placeholder) {
    return "border-toolbar-foreground/20 grid min-h-6 grid-cols-[2.5rem_minmax(0,1fr)] items-start border-x bg-white/[0.03] bg-[linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.05)_6px,rgba(255,255,255,0.05)_12px)]";
  }

  const base =
    "border-toolbar-foreground/20 grid min-h-6 grid-cols-[2.5rem_minmax(0,1fr)] items-start border-x";

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

function useLinkifyUrls(isLargeJson: boolean): boolean {
  const { linkifyUrls } = useContext(SettingsContext);
  return linkifyUrls && !isLargeJson;
}

function buildLineMatches(
  lines: RawDiffLine[],
  search: Search,
  linkifyUrls: boolean,
): LineMatchesFlattener {
  const lineMatches = new LineMatchesFlattener();

  lines.forEach((line) => {
    lineMatches.add(findMatches(line, search, linkifyUrls));
  });

  return lineMatches;
}

function findMatches(
  line: RawDiffLine,
  search: Search,
  linkifyUrls: boolean,
): MatchesResult {
  const text = line.text;
  const searchMatches = search.text
    ? matchSearch(text, search.text, search.caseSensitive)
    : [];

  return {
    syntaxMatches: matchJsonSyntax(text),
    diffMatches: buildDiffMatches(line.inlineDiffs ?? []),
    searchMatches,
    linkMatches: linkifyUrls ? matchLinks(text) : [],
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
    handlers: SearchMatchHandler[] | undefined,
  ) {
    if (!handlers) {
      return;
    }

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

function useEventListener(
  eventType: ViewerEventType,
  listener: (event: Event) => void,
) {
  useEffect(() => {
    document.addEventListener(eventType, listener);
    return () => document.removeEventListener(eventType, listener);
  }, [eventType, listener]);
}
