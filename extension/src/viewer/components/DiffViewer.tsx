import {
  compareJsonLines,
  DiffByPath,
  ignoreRawDiffLines,
  RawDiffLine,
} from "@/viewer/commons/Diff";
import * as Json from "@/viewer/commons/Json";
import { Search, SearchNavigation, ViewerMode } from "@/viewer/state";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  ReactNode,
  SetStateAction,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RawDiffViewer } from "./RawViewer/RawDiffViewer";
import { TreeViewer } from "./TreeViewer";

type PaneNavigationSetter = Dispatch<SetStateAction<SearchNavigation>>;

export type DiffViewerProps = Props<{
  viewerMode: ViewerMode;
  search: Search;
  searchStartingIndex: number;
  isLargeJsonLeft: boolean;
  isLargeJsonRight: boolean;
  leftLabel: string;
  rightLabel: string;
  leftJsonLines: Json.Lines;
  rightJsonLines: Json.Lines;
  leftDiffByPath: DiffByPath;
  rightDiffByPath: DiffByPath;
  leftRawLines: RawDiffLine[];
  rightRawLines: RawDiffLine[];
  ignorePatternText: string;
  setLeftSearchNavigation: PaneNavigationSetter;
  setRightSearchNavigation: PaneNavigationSetter;
  activePane: "left" | "right";
  setActivePane: (pane: "left" | "right") => void;
}>;

export function DiffViewer({
  viewerMode,
  search,
  searchStartingIndex,
  isLargeJsonLeft,
  isLargeJsonRight,
  leftLabel,
  rightLabel,
  leftJsonLines,
  rightJsonLines,
  leftDiffByPath,
  rightDiffByPath,
  leftRawLines,
  rightRawLines,
  ignorePatternText,
  setLeftSearchNavigation,
  setRightSearchNavigation,
  activePane,
  setActivePane,
  className,
}: DiffViewerProps): JSX.Element {
  const deferredPatternText = useDeferredValue(ignorePatternText);
  const patterns = useMemo(() => {
    const parsed: RegExp[] = [];
    for (const line of deferredPatternText.split("\n")) {
      const source = line.trim();
      if (!source) continue;
      try {
        parsed.push(new RegExp(source));
      } catch {
        return null;
      }
    }
    return parsed;
  }, [deferredPatternText]);
  const filteredRaw = useMemo(
    () =>
      viewerMode === ViewerMode.Raw && patterns?.length
        ? ignoreRawDiffLines(
            { left: leftRawLines, right: rightRawLines },
            patterns,
          )
        : { left: leftRawLines, right: rightRawLines },
    [viewerMode, leftRawLines, rightRawLines, patterns],
  );
  const filteredTree = useMemo(
    () =>
      viewerMode === ViewerMode.Tree && patterns?.length
        ? compareJsonLines(leftJsonLines, rightJsonLines, patterns)
        : { left: leftDiffByPath, right: rightDiffByPath },
    [
      viewerMode,
      leftJsonLines,
      rightJsonLines,
      leftDiffByPath,
      rightDiffByPath,
      patterns,
    ],
  );
  const [leftScrollElement, setLeftScrollElement] =
    useState<Nullable<HTMLElement>>(null);
  const [rightScrollElement, setRightScrollElement] =
    useState<Nullable<HTMLElement>>(null);
  useSynchronizedScroll(leftScrollElement, rightScrollElement);

  const setLeftScrollElementStable = useCallback(
    (element: Nullable<HTMLElement>) => setLeftScrollElement(element),
    [],
  );
  const setRightScrollElementStable = useCallback(
    (element: Nullable<HTMLElement>) => setRightScrollElement(element),
    [],
  );

  const viewer =
    viewerMode === ViewerMode.Raw ? (
      <RawDiffViewer
        className={className}
        leftLines={filteredRaw.left}
        rightLines={filteredRaw.right}
        search={search}
        isLargeJsonLeft={isLargeJsonLeft}
        isLargeJsonRight={isLargeJsonRight}
        setLeftSearchNavigation={setLeftSearchNavigation}
        setRightSearchNavigation={setRightSearchNavigation}
        activePane={activePane}
        setActivePane={setActivePane}
        searchStartingIndex={searchStartingIndex}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
      />
    ) : (
      <div
        className={classNames(
          "flex min-h-0 flex-1 gap-2 overflow-hidden px-1.5 pb-1.5",
          className,
        )}
      >
        <DiffPane
          className="min-w-0 flex-1"
          label={leftLabel}
          active={activePane === "left"}
          onActivate={() => setActivePane("left")}
        >
          <TreeViewer
            className="text-viewer-foreground h-full min-h-0 flex-1 pt-1.5 pl-1.5 selection:bg-amber-200 selection:text-black"
            jsonLines={leftJsonLines}
            enableEnterNode={false}
            search={search}
            setSearchNavigation={setLeftSearchNavigation}
            searchStartingIndex={searchStartingIndex}
            viewerId="left"
            diffByPath={filteredTree.left}
            onScrollElementChange={setLeftScrollElementStable}
          />
        </DiffPane>

        <DiffPane
          className="min-w-0 flex-1"
          label={rightLabel}
          active={activePane === "right"}
          onActivate={() => setActivePane("right")}
        >
          <TreeViewer
            className="text-viewer-foreground h-full min-h-0 flex-1 pt-1.5 pl-1.5 selection:bg-amber-200 selection:text-black"
            jsonLines={rightJsonLines}
            enableEnterNode={false}
            search={search}
            setSearchNavigation={setRightSearchNavigation}
            searchStartingIndex={searchStartingIndex}
            viewerId="right"
            diffByPath={filteredTree.right}
            onScrollElementChange={setRightScrollElementStable}
          />
        </DiffPane>
      </div>
    );
  return <div className="flex min-h-0 flex-1">{viewer}</div>;
}

function useSynchronizedScroll(
  left: Nullable<HTMLElement>,
  right: Nullable<HTMLElement>,
) {
  const lock = useRef<Nullable<HTMLElement>>(null);
  const frame = useRef<Nullable<number>>(null);

  useEffect(() => {
    if (!left || !right) {
      return;
    }

    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (lock.current === source) {
        return;
      }

      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }

      lock.current = target;
      frame.current = requestAnimationFrame(() => {
        target.scrollTop = mapScrollPosition(
          source.scrollTop,
          source.scrollHeight,
          source.clientHeight,
          target.scrollHeight,
          target.clientHeight,
        );
        target.scrollLeft = mapScrollPosition(
          source.scrollLeft,
          source.scrollWidth,
          source.clientWidth,
          target.scrollWidth,
          target.clientWidth,
        );

        requestAnimationFrame(() => {
          lock.current = null;
          frame.current = null;
        });
      });
    };

    const onLeftScroll = () => sync(left, right);
    const onRightScroll = () => sync(right, left);

    left.addEventListener("scroll", onLeftScroll, { passive: true });
    right.addEventListener("scroll", onRightScroll, { passive: true });

    return () => {
      left.removeEventListener("scroll", onLeftScroll);
      right.removeEventListener("scroll", onRightScroll);
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      lock.current = null;
      frame.current = null;
    };
  }, [left, right]);
}

function mapScrollPosition(
  sourcePosition: number,
  sourceSize: number,
  sourceViewport: number,
  targetSize: number,
  targetViewport: number,
): number {
  const sourceMax = sourceSize - sourceViewport;
  const targetMax = targetSize - targetViewport;

  if (sourceMax <= 0 || targetMax <= 0) {
    return 0;
  }

  return (sourcePosition / sourceMax) * targetMax;
}

type DiffPaneProps = Props<{
  label: string;
  active: boolean;
  onActivate: () => void;
  children: ReactNode;
}>;

function DiffPane({
  label,
  active,
  onActivate,
  children,
  className,
}: DiffPaneProps): JSX.Element {
  return (
    <section
      className={classNames(
        "border-toolbar-foreground/20 flex min-h-0 flex-col overflow-hidden rounded-sm border",
        { "ring-toolbar-foreground/40 ring-1": active },
        className,
      )}
      onMouseDown={onActivate}
      onFocusCapture={onActivate}
    >
      <header className="bg-toolbar-background text-toolbar-foreground truncate px-2 py-1 text-sm">
        {label}
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
