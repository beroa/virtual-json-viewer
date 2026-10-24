import * as Json from "@/viewer/commons/Json";
import { Icon, IconButton } from "@/viewer/components";
import { StateObject } from "@/viewer/hooks";
import { TranslationContext } from "@/viewer/localization";
import {
  JQCommand,
  Search,
  SearchNavigation,
  ViewerMode,
} from "@/viewer/state";
import classNames from "classnames";
import {
  ChangeEvent,
  Dispatch,
  JSX,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { JQCommandBox } from "./JQCommandBox";
import { OpenStateToggle } from "./OpenStateToggle";
import { SaveButton } from "./SaveButton";
import { SearchBox } from "./SearchBox";
import { ViewerModeToggle } from "./ViewerModeToggle";

export type CompareState = {
  url: string;
  isDiffMode: boolean;
  isLoading: boolean;
  error: Nullable<string>;
  activeViewerId?: string;
};

export type ToolbarProps = Props<{
  jsonLines: Json.Lines;
  viewerModeState: StateObject<ViewerMode>;
  searchState: StateObject<Search>;
  searchNavigation: SearchNavigation;
  jqCommandState?: StateObject<JQCommand>;
  compareState?: CompareState;
  compareControlsVisible?: boolean;
  setCompareControlsVisible?: Dispatch<SetStateAction<boolean>>;
  showParentKeys: boolean;
  setShowParentKeys: Dispatch<SetStateAction<boolean>>;
  setCompareUrl?: (url: string) => void;
  onCompare?: () => void;
  onClearCompare?: () => void;
  ignorePatternText: string;
  setIgnorePatternText: (text: string) => void;
}>;

export function Toolbar({
  jsonLines,
  viewerModeState,
  searchState,
  searchNavigation,
  jqCommandState,
  compareState,
  compareControlsVisible,
  setCompareControlsVisible,
  showParentKeys,
  setShowParentKeys,
  setCompareUrl,
  onCompare,
  onClearCompare,
  ignorePatternText,
  setIgnorePatternText,
  className,
}: ToolbarProps): JSX.Element {
  const t = useContext(TranslationContext);
  const isTreeView = viewerModeState.value === ViewerMode.Tree;
  const compareEnabled = !!compareState && !!setCompareUrl && !!onCompare;
  const isCompareControlsVisible = compareControlsVisible ?? false;

  return (
    <div
      className={classNames(
        "bg-toolbar-background flex flex-col px-0.5 py-1",
        className,
      )}
    >
      <div className="flex items-center">
        <ViewerModeToggle
          className="ml-1 h-7 w-14"
          viewerMode={viewerModeState.value}
          setViewerMode={viewerModeState.setValue}
        />

        <Separator />

        <OpenStateToggle className="h-7 w-14 px-px" />

        <Separator />

        <IconButton
          className={classNames("fill-toolbar-foreground h-6 w-6", {
            "hover:bg-toolbar-focus": isTreeView && !showParentKeys,
            "bg-toolbar-focus": isTreeView && showParentKeys,
          })}
          title={
            showParentKeys ? t.toolbar.parents.hide : t.toolbar.parents.show
          }
          icon={Icon.ListTree}
          onClick={() => setShowParentKeys((show) => !show)}
          disabled={!isTreeView}
        />

        <Separator />

        <SaveButton className="h-6 w-6 px-px" jsonLines={jsonLines} />

        <SearchBox
          className="ml-2 flex-1"
          search={searchState.value}
          setSearch={searchState.setValue}
          navigation={searchNavigation}
          enableVisibility={isTreeView}
          viewerId={compareState?.activeViewerId}
        />

        {compareEnabled && setCompareControlsVisible && (
          <IconButton
            className={classNames(
              "fill-toolbar-foreground hover:bg-toolbar-focus ml-1 h-6 w-6",
              {
                "bg-toolbar-focus": isCompareControlsVisible,
              },
            )}
            title={
              isCompareControlsVisible
                ? t.toolbar.compare.hide
                : t.toolbar.compare.show
            }
            icon={isCompareControlsVisible ? Icon.Close : Icon.Files}
            onClick={() => {
              if (!isCompareControlsVisible)
                setCompareUrl(window.location.href);
              setCompareControlsVisible((visible) => !visible);
            }}
          />
        )}
      </div>

      {compareEnabled && isCompareControlsVisible && (
        <CompareControls
          className="pt-1"
          compareState={compareState}
          setCompareUrl={setCompareUrl}
          onCompare={onCompare}
          onClearCompare={onClearCompare!}
          showIgnoreLines={compareState.isDiffMode}
          ignorePatternText={ignorePatternText}
          setIgnorePatternText={setIgnorePatternText}
        />
      )}

      {jqCommandState && (
        <div className="pt-1">
          <JQCommandBox
            command={jqCommandState.value}
            setCommand={jqCommandState.setValue}
            isMultilineOutput={jsonLines.length > 1}
          />
        </div>
      )}
    </div>
  );
}

type IgnoreLinesControlProps = {
  patternText: string;
  onApply: (patternText: string) => void;
};

function IgnoreLinesControl({
  patternText,
  onApply,
}: IgnoreLinesControlProps): JSX.Element {
  const t = useContext(TranslationContext).diffIgnore;
  const [dialogVisible, setDialogVisible] = useState(false);
  const [draftPatternText, setDraftPatternText] = useState(patternText);
  const active = patternText.trim().length > 0;
  const draftInvalid = useMemo(
    () =>
      draftPatternText.split("\n").some((line) => {
        const source = line.trim();
        if (!source) return false;
        try {
          new RegExp(source);
          return false;
        } catch {
          return true;
        }
      }),
    [draftPatternText],
  );

  useEffect(() => {
    if (!dialogVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogVisible(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogVisible]);

  return (
    <>
      <button
        type="button"
        className={classNames(
          "rounded-sm px-2 py-1 text-xs",
          active
            ? "bg-red-600 text-white"
            : "text-toolbar-foreground hover:bg-toolbar-focus",
        )}
        aria-haspopup="dialog"
        onClick={() => {
          setDraftPatternText(patternText);
          setDialogVisible(true);
        }}
      >
        {active ? t.active : t.button}
      </button>
      {dialogVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="diff-ignore-title"
            className="bg-toolbar-background text-toolbar-foreground border-toolbar-foreground/30 flex w-full max-w-lg flex-col gap-3 rounded-md border p-4 shadow-xl"
          >
            <h2 id="diff-ignore-title" className="text-base font-semibold">
              {t.title}
            </h2>
            <p id="diff-ignore-help" className="text-sm">
              {t.help}
            </p>
            <textarea
              autoFocus
              aria-label={t.title}
              aria-invalid={draftInvalid}
              aria-describedby="diff-ignore-help"
              className="bg-input-background text-input-foreground min-h-40 w-full resize-y rounded-sm px-2 py-1 font-mono"
              placeholder={t.placeholder}
              value={draftPatternText}
              onChange={(event) => setDraftPatternText(event.target.value)}
            />
            {draftInvalid && (
              <span className="text-sm text-red-300" role="alert">
                {t.invalid}
              </span>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="text-toolbar-foreground rounded-sm px-3 py-1"
                onClick={() => {
                  setDraftPatternText("");
                  onApply("");
                  setDialogVisible(false);
                }}
              >
                {t.clear}
              </button>
              <button
                type="button"
                className="text-toolbar-foreground rounded-sm px-3 py-1"
                onClick={() => setDialogVisible(false)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="bg-toolbar-focus text-toolbar-foreground rounded-sm px-3 py-1 disabled:opacity-50"
                disabled={draftInvalid}
                onClick={() => {
                  onApply(draftPatternText);
                  setDialogVisible(false);
                }}
              >
                {t.apply}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Separator(): JSX.Element {
  return <div className="border-toolbar-foreground/75 mx-2 h-3/4 border-l" />;
}

type CompareControlsProps = Props<{
  compareState: CompareState;
  setCompareUrl: (url: string) => void;
  onCompare: () => void;
  onClearCompare: () => void;
  showIgnoreLines: boolean;
  ignorePatternText: string;
  setIgnorePatternText: (text: string) => void;
}>;

function CompareControls({
  compareState,
  setCompareUrl,
  onCompare,
  onClearCompare,
  showIgnoreLines,
  ignorePatternText,
  setIgnorePatternText,
  className,
}: CompareControlsProps): JSX.Element {
  const t = useContext(TranslationContext);
  const onChange = (event: ChangeEvent<HTMLInputElement>) =>
    setCompareUrl(event.target.value);

  return (
    <div className={classNames("flex items-center gap-2", className)}>
      <input
        className="border-input-background bg-input-background text-input-foreground placeholder-input-foreground/50 min-w-0 flex-1 rounded-sm border px-2 py-1 focus:outline-hidden"
        ref={focusCompareInput}
        placeholder={t.toolbar.compare.placeholder}
        value={compareState.url}
        onChange={onChange}
      />

      <button
        className="bg-toolbar-focus text-toolbar-foreground rounded-sm px-2 py-1 enabled:hover:cursor-pointer disabled:opacity-50"
        onClick={onCompare}
        disabled={!compareState.url || compareState.isLoading}
      >
        {compareState.isLoading
          ? t.toolbar.compare.loading
          : t.toolbar.compare.run}
      </button>

      {showIgnoreLines && (
        <IgnoreLinesControl
          patternText={ignorePatternText}
          onApply={setIgnorePatternText}
        />
      )}

      {compareState.isDiffMode && (
        <button
          className="text-toolbar-foreground enabled:hover:border-toolbar-foreground/25 rounded-sm border border-transparent px-2 py-1 enabled:hover:cursor-pointer"
          onClick={onClearCompare}
        >
          {t.toolbar.compare.clear}
        </button>
      )}

      {compareState.error && (
        <span className="text-sm text-red-300">{compareState.error}</span>
      )}
    </div>
  );
}

function focusCompareInput(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}
