import {
  compareJsonLines,
  DiffByPath,
  ignoreRawDiffLines,
  RawDiffLine,
} from "@/viewer/commons/Diff";
import * as Json from "@/viewer/commons/Json";
import { TranslationContext } from "@/viewer/localization";
import { Search, SearchNavigation, ViewerMode } from "@/viewer/state";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
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
  setLeftSearchNavigation,
  setRightSearchNavigation,
  activePane,
  setActivePane,
  className,
}: DiffViewerProps): JSX.Element {
  const t = useContext(TranslationContext).diffIgnore;
  const [controlsVisible, setControlsVisible] = useState(false);
  const [patternText, setPatternText] = useState("");
  const pattern = useMemo(() => {
    if (!patternText) return null;
    try {
      return new RegExp(patternText);
    } catch {
      return null;
    }
  }, [patternText]);
  const invalid = !!patternText && !pattern;
  const filteredRaw = useMemo(
    () =>
      pattern
        ? ignoreRawDiffLines(
            { left: leftRawLines, right: rightRawLines },
            pattern,
          )
        : { left: leftRawLines, right: rightRawLines },
    [leftRawLines, rightRawLines, pattern],
  );
  const filteredTree = useMemo(
    () =>
      pattern
        ? compareJsonLines(leftJsonLines, rightJsonLines, pattern)
        : { left: leftDiffByPath, right: rightDiffByPath },
    [leftJsonLines, rightJsonLines, leftDiffByPath, rightDiffByPath, pattern],
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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-toolbar-background text-toolbar-foreground flex flex-wrap items-center gap-2 px-2 py-1">
        <button
          type="button"
          className="bg-toolbar-focus rounded-sm px-2 py-1"
          aria-expanded={controlsVisible}
          onClick={() => setControlsVisible(!controlsVisible)}
        >
          {pattern ? t.active : t.button}
        </button>
        {controlsVisible && (
          <>
            <input
              autoFocus
              aria-label={t.button}
              aria-invalid={invalid}
              aria-describedby="diff-ignore-help"
              className="bg-input-background text-input-foreground min-w-48 flex-1 rounded-sm px-2 py-1"
              placeholder={t.placeholder}
              value={patternText}
              onChange={(event) => setPatternText(event.target.value)}
            />
            <button type="button" onClick={() => setPatternText("")}>
              {t.clear}
            </button>
            <span
              id="diff-ignore-help"
              className="w-full text-sm"
              role={invalid ? "alert" : undefined}
            >
              {invalid ? t.invalid : t.help}
            </span>
          </>
        )}
      </div>
      {viewer}
    </div>
  );
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
