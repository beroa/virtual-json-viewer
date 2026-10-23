import * as DOM from "@/viewer/commons/Dom";
import {
  ViewerEventType,
  shouldHandleViewerEvent,
} from "@/viewer/commons/EventBus";
import { RawDiffLine } from "@/viewer/commons/Diff";
import * as Json from "@/viewer/commons/Json";
import {
  CHORD_KEY,
  KeydownEvent,
  SetValue,
  useEventBusListener,
  useGlobalKeydownEvent,
} from "@/viewer/hooks";
import { Search, SearchNavigation, SettingsContext } from "@/viewer/state";
import classNames from "classnames";
import {
  JSX,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchMatchHandler } from "../RenderedText";
import { RenderedLines } from "./RenderedLines";
import { SearchMatchNavigator } from "./SearchMatchNavigator";

export type RawViewerProps = Props<{
  jsonLines: Json.Lines;
  search: Search;
  setSearchNavigation: SetValue<SearchNavigation>;
  searchStartingIndex: number;
  isLargeJson: boolean;
  viewerId?: string;
  displayLines?: RawDiffLine[];
  onScrollElementChange?: (element: Nullable<HTMLElement>) => void;
}>;

export function RawViewer({
  jsonLines,
  search,
  isLargeJson,
  setSearchNavigation,
  searchStartingIndex,
  viewerId = "main",
  displayLines,
  onScrollElementChange,
  className,
}: RawViewerProps): JSX.Element {
  const { indentation, sortKeys } = useContext(SettingsContext);

  // Collapse/expand state
  const [minify, setMinify] = useState(false);

  const expand = useCallback(() => setMinify(false), [setMinify]);
  useEventBusListener(ViewerEventType.Expand, expand);

  const collapse = useCallback(() => setMinify(true), [setMinify]);
  useEventBusListener(ViewerEventType.Collapse, collapse);

  // Linkify URLs
  const linkifyUrls = useLinkifyUrls(isLargeJson, minify);

  // Raw text
  const space = minify ? undefined : indentation;

  const rawLines = useMemo(
    () => jsonLines.map((line) => Json.toString(line, { sortKeys, space })),
    [jsonLines, sortKeys, space],
  );
  const renderedLines = displayLines ?? undefined;
  const effectiveRawLines = renderedLines?.map((line) => line.text) ?? rawLines;

  // Navigation
  const navigator = useRef<SearchMatchNavigator>(new SearchMatchNavigator());
  navigator.current.observeNavigation(setSearchNavigation);

  const goToPreviousMatch = useCallback(
    (event: Event) => {
      if (!shouldHandleViewerEvent(event, viewerId)) return;
      navigator.current.goToPreviousMatch();
    },
    [navigator, viewerId],
  );
  useEventBusListener(
    ViewerEventType.SearchNavigatePrevious,
    goToPreviousMatch,
  );

  const goToNextMatch = useCallback(
    (event: Event) => {
      if (!shouldHandleViewerEvent(event, viewerId)) return;
      navigator.current.goToNextMatch();
    },
    [navigator, viewerId],
  );
  useEventBusListener(ViewerEventType.SearchNavigateNext, goToNextMatch);

  // Register shortcuts
  const ref = useRef<Nullable<HTMLDivElement>>(null);
  useEffect(() => {
    onScrollElementChange?.(ref.current);
    return () => onScrollElementChange?.(null);
  }, [onScrollElementChange]);

  const handleNavigation = useCallback(
    (e: KeydownEvent) => {
      if (e[CHORD_KEY] && e.key === "0") {
        e.preventDefault();
        ref.current?.focus();
      }
    },
    [ref],
  );
  useGlobalKeydownEvent(handleNavigation);

  const handleSelectAll = (e: React.KeyboardEvent) => {
    if (e[CHORD_KEY] && e.key === "a") {
      e.preventDefault();
      if (ref.current) DOM.selectAllText(ref.current);
      return;
    }

    if (e.key == "Escape") {
      e.preventDefault();
      DOM.deselectAllText();
      return;
    }
  };

  const wrap = minify ? "break-all" : "whitespace-pre-wrap break-words";

  // Reset the navigator when search matches change.
  // Starting index is not a dependency, because it must not trigger a reset.
  // It's important that the effect lives here to use the most updated starting index props.
  const [searchMatches, setSearchMatches] =
    useState<Nullable<SearchMatchHandler[]>>(null);
  useEffect(() => {
    if (searchMatches) {
      navigator.current.reset(searchMatches, searchStartingIndex);
    }
  }, [navigator, searchMatches]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={classNames("h-full overflow-auto", wrap, className)}
      spellCheck={false}
      onKeyDown={handleSelectAll}
    >
      <RenderedLines
        rawLines={renderedLines ? undefined : effectiveRawLines}
        lines={renderedLines}
        search={search}
        linkifyUrls={linkifyUrls}
        onSearchMatchesUpdate={setSearchMatches}
      />
    </div>
  );
}

function useLinkifyUrls(isLargeJson: boolean, minify: boolean): boolean {
  const { linkifyUrls: linkifyUrlsSettings } = useContext(SettingsContext);

  // disable linkify when collapsed to excessive false positives
  const linkifyUrlsExpected = linkifyUrlsSettings && !minify;

  // disable linkify for large text to improve performance
  const linkifyUrls = linkifyUrlsExpected && !isLargeJson;
  useEffect(() => {
    if (linkifyUrlsExpected && !linkifyUrls) {
      console.info(
        "Large amount of text detected: Linkify URL has been disabled to improve performance",
      );
    }
  }, [linkifyUrlsExpected, isLargeJson]);

  return linkifyUrls;
}
