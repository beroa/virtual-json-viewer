import "@/global.css";
import * as Diff from "@/viewer/commons/Diff";
import * as Json from "@/viewer/commons/Json";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  SetStateAction,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isActiveElementEditable } from "./commons/Dom";
import {
  Alert,
  DiffViewer,
  RawViewer,
  RawViewerProps,
  Toolbar,
  TreeViewer,
  TreeViewerProps,
  ViewerPlaceholder,
} from "./components";
import { MultiContextProvider } from "./components/MultiContextProvider";
import {
  CHORD_KEY,
  JQResult,
  KeydownEvent,
  useEffectAsync,
  useGlobalKeydownEvent,
  useJQ,
} from "./hooks";
import {
  Translation,
  TranslationContext,
  useLocalization,
} from "./localization";
import {
  ApplicationState,
  EmptyJQCommand,
  EmptySearchNavigation,
  SearchNavigation,
  Settings,
  SettingsContext,
  ViewerMode,
  resolveTextSizeClass,
  useApplicationState,
  useSettings,
  useTheme,
} from "./state";

// heuristic: https://media.tenor.com/6PFS7ABeJGEAAAAC/dr-evil-one-billion-dollars.gif
const LARGE_JSON_LENGTH = 1_000_000;

export type AppProps = {
  jsonText: string;
};

type ViewerProps = TreeViewerProps & RawViewerProps;

export function App({ jsonText }: AppProps): JSX.Element {
  // Global settings
  const [theme] = useTheme();
  const [translation] = useLocalization();
  const [settings] = useSettings();

  const isLoaded = theme != null && translation != null && settings != null;

  return isLoaded ? (
    <LoadedApp
      jsonText={jsonText}
      settings={settings}
      translation={translation}
    />
  ) : (
    <div />
  );
}

type LoadedAppProps = {
  jsonText: string;
  settings: Settings;
  translation: Translation;
};

type CompareLoadState = {
  status: "idle" | "loading" | "loaded" | "error";
  jsonText: string;
  error: Nullable<string>;
};

function LoadedApp({
  jsonText,
  settings,
  translation,
}: LoadedAppProps): JSX.Element {
  // Parse json
  const jsonResult = useMemo(
    () => Json.tryParseLines(jsonText, { sortKeys: settings.sortKeys }),
    [jsonText, settings.sortKeys],
  );
  const isInputMultiline = isMultipleJsonLines(jsonResult);

  // Application state
  const state = useApplicationState(settings, isInputMultiline);

  // Apply jq filter
  const jqCommand = state.diffMode.value
    ? EmptyJQCommand
    : state.jqCommand.value;
  const [jqEnabled, jqResult] = useJQ(jsonText, jqCommand);
  const [jsonLines, error] = resolveJson(jsonResult, jqResult);

  const [compareRequestId, setCompareRequestId] = useState(0);
  const [compareLoadState, setCompareLoadState] = useState<CompareLoadState>({
    status: "idle",
    jsonText: "",
    error: null,
  });
  const [compareControlsVisible, setCompareControlsVisible] = useState(
    () => Boolean(state.compareUrl.value || state.diffMode.value),
  );
  const [showParentKeys, setShowParentKeys] = useState(false);

  useEffectAsync(async (mutex) => {
    if (!state.diffMode.value || !state.compareUrl.value) {
      if (mutex.hasLock()) {
        setCompareLoadState({ status: "idle", jsonText: "", error: null });
      }
      return;
    }

    setCompareLoadState((current) => ({
      status: "loading",
      jsonText: current.jsonText,
      error: null,
    }));

    try {
      const response = await fetch(state.compareUrl.value);
      if (!response.ok) {
        throw new Error(
          `GET ${state.compareUrl.value} - ${response.status} ${response.statusText}`,
        );
      }

      const compareJsonText = await response.text();
      if (!mutex.hasLock()) return;

      setCompareLoadState({
        status: "loaded",
        jsonText: compareJsonText,
        error: null,
      });
    } catch (e) {
      if (!mutex.hasLock()) return;
      setCompareLoadState({
        status: "error",
        jsonText: "",
        error: (e as Error).message,
      });
    }
  }, [state.diffMode.value, state.compareUrl.value, compareRequestId]);

  const compareJsonResult = useMemo(() => {
    if (compareLoadState.status !== "loaded") {
      return null;
    }

    return Json.tryParseLines(compareLoadState.jsonText, {
      sortKeys: settings.sortKeys,
    });
  }, [compareLoadState, settings.sortKeys]);

  const compareJsonLines =
    compareJsonResult instanceof Error || compareJsonResult === null
      ? null
      : compareJsonResult;

  const compareError =
    compareLoadState.error ??
    (compareJsonResult instanceof Error ? compareJsonResult.message : null);

  const diffResult = useMemo(() => {
    if (
      !state.diffMode.value ||
      jsonLines === null ||
      compareJsonLines === null
    ) {
      return null;
    }
    return Diff.compareJsonLines(jsonLines, compareJsonLines);
  }, [state.diffMode.value, jsonLines, compareJsonLines]);

  const [leftSearchNavigation, setLeftSearchNavigation] =
    useState(EmptySearchNavigation);
  const [rightSearchNavigation, setRightSearchNavigation] =
    useState(EmptySearchNavigation);
  const [activePane, setActivePane] = useState<"left" | "right">("left");

  const diffReady =
    state.diffMode.value &&
    jsonLines !== null &&
    compareJsonLines !== null &&
    diffResult !== null &&
    compareError === null;

  useEffect(() => {
    if (!diffReady) {
      return;
    }

    state.searchNavigation.setValue(
      activePane === "left" ? leftSearchNavigation : rightSearchNavigation,
    );
  }, [
    activePane,
    diffReady,
    leftSearchNavigation,
    rightSearchNavigation,
    state.searchNavigation,
  ]);

  // Build props for the viewer, with deferred transition for large JSON
  const viewerPropsParams = {
    state,
    jsonLines,
    isLargeJson: jsonText.length > LARGE_JSON_LENGTH,
    enableEnterNode: !state.diffMode.value && jqEnabled && error === null,
    showParentKeys,
  };
  const viewerProps = useTransitionViewerProps(viewerPropsParams);

  // Browser default's "select all" behavior is not meaningful in the viewer,
  // children components should handle their own selection (except for standard input elements)
  const disableSelectAll = useCallback((e: KeydownEvent) => {
    if (e[CHORD_KEY] && e.key === "a" && !isActiveElementEditable()) {
      e.preventDefault();
    }
  }, []);
  useGlobalKeydownEvent(disableSelectAll);

  // -- No hooks below -- //

  // Fatal error page
  if (jsonLines === null) {
    return (
      <div className="flex h-full flex-col font-mono">
        <Alert>{error?.message}</Alert>
        <div className="p-3 whitespace-pre">{jsonText}</div>
      </div>
    );
  }

  const toolbarProps = {
    jsonLines,
    viewerModeState: state.viewerMode,
    searchState: state.search,
    searchNavigation: diffReady
      ? activePane === "left"
        ? leftSearchNavigation
        : rightSearchNavigation
      : state.searchNavigation.value,
    jqCommandState:
      !state.diffMode.value && jqEnabled ? state.jqCommand : undefined,
    compareState: {
      url: state.compareUrl.value,
      isDiffMode: state.diffMode.value,
      isLoading: compareLoadState.status === "loading",
      error: compareError,
      activeViewerId: diffReady ? activePane : "main",
    },
    compareControlsVisible,
    setCompareControlsVisible,
    showParentKeys,
    setShowParentKeys,
    setCompareUrl: (url: string) => state.compareUrl.setValue(url),
    onCompare: () => {
      if (!state.compareUrl.value) return;
      setCompareControlsVisible(true);
      state.diffMode.setValue(true);
      state.viewerMode.setValue(ViewerMode.Raw);
      setCompareRequestId((id) => id + 1);
    },
    onClearCompare: () => {
      state.diffMode.setValue(false);
      state.compareUrl.setValue("");
      setCompareLoadState({ status: "idle", jsonText: "", error: null });
    },
  };

  const Viewer =
    state.viewerMode.value === ViewerMode.Tree ? TreeViewer : RawViewer;

  return (
    <MultiContextProvider
      contexts={[
        [TranslationContext, translation],
        [SettingsContext, settings],
      ]}
    >
      <div className="bg-viewer-background flex h-full min-h-[500px] min-w-[500px] flex-col overflow-hidden font-mono">
        <Toolbar {...toolbarProps} />

        {error && (
          <Alert>
            <JqErrorTitle error={error} />
            {error.message}
          </Alert>
        )}

        {viewerProps === null ? (
          <ViewerPlaceholder className="flex-auto" />
        ) : diffReady ? (
          <DiffModeView
            state={state}
            jsonText={jsonText}
            jsonLines={jsonLines}
            compareUrl={state.compareUrl.value}
            compareJsonText={compareLoadState.jsonText}
            compareJsonLines={compareJsonLines}
            diffResult={diffResult}
            leftSearchNavigation={setLeftSearchNavigation}
            rightSearchNavigation={setRightSearchNavigation}
            activePane={activePane}
            setActivePane={setActivePane}
          />
        ) : (
          <Viewer
            {...viewerProps}
            className={classNames(
              // min-h-0 prevents overflow when showing an error banner (https://stackoverflow.com/a/66689926)
              "text-viewer-foreground min-h-0 flex-auto pt-1.5 pl-1.5 selection:bg-amber-200 selection:text-black",
              resolveTextSizeClass(settings.textSize),
            )}
          />
        )}
      </div>
    </MultiContextProvider>
  );
}

type DiffModeViewProps = {
  state: ApplicationState;
  jsonText: string;
  jsonLines: Json.Lines;
  compareUrl: string;
  compareJsonText: string;
  compareJsonLines: Json.Lines;
  diffResult: Diff.DiffResult;
  leftSearchNavigation: Dispatch<SetStateAction<SearchNavigation>>;
  rightSearchNavigation: Dispatch<SetStateAction<SearchNavigation>>;
  activePane: "left" | "right";
  setActivePane: (pane: "left" | "right") => void;
};

function DiffModeView({
  state,
  jsonText,
  jsonLines,
  compareUrl,
  compareJsonText,
  compareJsonLines,
  diffResult,
  leftSearchNavigation,
  rightSearchNavigation,
  activePane,
  setActivePane,
}: DiffModeViewProps): JSX.Element {
  const { indentation, sortKeys, textSize } = useContext(SettingsContext);

  const leftRawLines = useMemo(
    () =>
      jsonLines.flatMap((line) =>
        Json.toString(line, { sortKeys, space: indentation }).split("\n"),
      ),
    [jsonLines, sortKeys, indentation],
  );
  const rightRawLines = useMemo(
    () =>
      compareJsonLines.flatMap((line) =>
        Json.toString(line, { sortKeys, space: indentation }).split("\n"),
      ),
    [compareJsonLines, sortKeys, indentation],
  );
  const rawDiff = useMemo(
    () => Diff.compareRawLines(leftRawLines, rightRawLines),
    [leftRawLines, rightRawLines],
  );

  return (
    <DiffViewer
      className={resolveTextSizeClass(textSize)}
      viewerMode={state.viewerMode.value}
      search={state.search.value}
      searchStartingIndex={state.searchStartingIndex}
      isLargeJsonLeft={jsonText.length > LARGE_JSON_LENGTH}
      isLargeJsonRight={compareJsonText.length > LARGE_JSON_LENGTH}
      leftLabel={window.location.href}
      rightLabel={compareUrl}
      leftJsonLines={jsonLines}
      rightJsonLines={compareJsonLines}
      leftDiffByPath={diffResult.left}
      rightDiffByPath={diffResult.right}
      leftRawLines={rawDiff.left}
      rightRawLines={rawDiff.right}
      setLeftSearchNavigation={leftSearchNavigation}
      setRightSearchNavigation={rightSearchNavigation}
      activePane={activePane}
      setActivePane={setActivePane}
    />
  );
}

type ViewerPropsParams = {
  state: ApplicationState;
  jsonLines: Nullable<Json.Lines>;
  isLargeJson: boolean;
  enableEnterNode: boolean;
  showParentKeys: boolean;
};

// Defer state transition in case of large JSON in order to show loading placeholder
function useTransitionViewerProps({
  state,
  jsonLines,
  isLargeJson,
  enableEnterNode,
  showParentKeys,
}: ViewerPropsParams): Nullable<ViewerProps> {
  const [nextProps, setNextProps] = useState<Nullable<ViewerProps>>(null);
  const deferredProps = useDeferredValue<Nullable<ViewerProps>>(nextProps);

  // Changes to these props will trigger a possibly expensive render of the viewer
  const transitionDeps = [
    // Transition between viewer modes
    state.viewerMode.value,
    // Viewer props
    jsonLines,
    state.search.value,
    isLargeJson,
    enableEnterNode,
    showParentKeys,
    // searchStartingIndex MUST not trigger re-render: changes are meaningful only if search-related props change
  ];

  const targetProps = useMemo(() => {
    if (jsonLines === null) {
      // nothing to show
      return null;
    }

    // Remember to add expensive props to transitionDeps
    return {
      jsonLines,
      search: state.search.value,
      setSearchNavigation: state.searchNavigation.setValue,
      searchStartingIndex: state.searchStartingIndex,
      isLargeJson,
      enableEnterNode,
      showParentKeys,
    };
  }, transitionDeps);

  useEffect(() => {
    const updateTask = setTimeout(() => setNextProps(targetProps), 1);
    return () => clearTimeout(updateTask);
  }, [setNextProps, targetProps]);

  // If the JSON is small, target props are applied immediately
  if (!isLargeJson) {
    return targetProps;
  }

  // The JSON is large, target props will be applied after a short delay
  const isTransition = deferredProps !== targetProps;
  return isTransition ? null : deferredProps;
}

function resolveJson(
  jsonResult: Result<Json.Lines>,
  jqResult: JQResult,
): [Nullable<Json.Lines>, Nullable<Error>] {
  if (jsonResult instanceof Error) {
    return [null, jsonResult];
  }

  if (jqResult === undefined) {
    return [jsonResult, null];
  }

  if (jqResult instanceof Error) {
    return [jsonResult, jqResult];
  }

  return [jqResult, null];
}

function isMultipleJsonLines(
  result: Json.Lines | Error | undefined | null,
): result is Json.Lines {
  return Array.isArray(result) && result.length > 1;
}

type JqErrorTitleProps = Props<{
  error: Error;
}>;

function JqErrorTitle(_props: JqErrorTitleProps): JSX.Element {
  const t = useContext(TranslationContext);
  return <div className={"font-bold"}>{t.toolbar.jq.genericError}</div>;
}
