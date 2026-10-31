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
  isAccurate: boolean;
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
  jqUnavailable?: boolean;
  compareState?: CompareState;
  compareControlsVisible?: boolean;
  setCompareControlsVisible?: Dispatch<SetStateAction<boolean>>;
  showParentKeys: boolean;
  setShowParentKeys: Dispatch<SetStateAction<boolean>>;
  onCompare?: (url: string) => void;
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
  jqUnavailable = false,
  compareState,
  compareControlsVisible,
  setCompareControlsVisible,
  showParentKeys,
  setShowParentKeys,
  onCompare,
  onClearCompare,
  ignorePatternText,
  setIgnorePatternText,
  className,
}: ToolbarProps): JSX.Element {
  const t = useContext(TranslationContext);
  const [compareUrlDraft, setCompareUrlDraft] = useState(
    compareState?.url ?? "",
  );
  useEffect(() => {
    setCompareUrlDraft(compareState?.url ?? "");
  }, [compareState?.url]);

  const isTreeView = viewerModeState.value === ViewerMode.Tree;
  const isDiffMode = compareState?.isDiffMode ?? false;
  const compareEnabled = !!compareState && !!onCompare;
  const isCompareControlsVisible = compareControlsVisible ?? false;

  return (
    <div
      className={classNames(
        "bg-toolbar-background flex flex-col px-0.5 py-1",
        className,
      )}
    >
      <div className="flex items-center">
        {!isDiffMode && (
          <>
            <ViewerModeToggle
              className="ml-1 h-7 w-14"
              viewerMode={viewerModeState.value}
              setViewerMode={viewerModeState.setValue}
            />

            <Separator />

            <OpenStateToggle className="h-7 w-14 px-px" />

            {isTreeView && <Separator />}

            {isTreeView && (
              <IconButton
                className={classNames("fill-toolbar-foreground h-6 w-6", {
                  "hover:bg-toolbar-focus": !showParentKeys,
                  "bg-toolbar-focus": showParentKeys,
                })}
                title={t.toolbar.parents.show}
                icon={Icon.ListTree}
                onClick={() => setShowParentKeys((show) => !show)}
              />
            )}

            {isTreeView && <Separator />}

            <SaveButton className="h-6 w-6 px-px" jsonLines={jsonLines} />
          </>
        )}

        <SearchBox
          className={classNames("flex-1", { "ml-2": !isDiffMode })}
          search={searchState.value}
          setSearch={searchState.setValue}
          navigation={searchNavigation}
          enableVisibility={isTreeView && !isDiffMode}
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
              if (isCompareControlsVisible) {
                setCompareControlsVisible(false);
                if (compareState.isDiffMode) onClearCompare?.();
              } else {
                setCompareUrlDraft(window.location.href);
                setCompareControlsVisible(true);
              }
            }}
          />
        )}
      </div>

      {compareEnabled && isCompareControlsVisible && (
        <CompareControls
          className="pt-1"
          compareState={compareState}
          compareUrl={compareUrlDraft}
          setCompareUrl={setCompareUrlDraft}
          onCompare={() => onCompare(compareUrlDraft)}
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
            unavailable={jqUnavailable}
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
  const [draftInvalid, setDraftInvalid] = useState(false);
  const active = patternText.trim().length > 0;

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
          setDraftInvalid(false);
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
              onChange={(event) => {
                setDraftPatternText(event.target.value);
                setDraftInvalid(false);
              }}
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
                  setDraftInvalid(false);
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
                  const invalid = draftPatternText.split("\n").some((line) => {
                    const source = line.trim();
                    if (!source) return false;
                    try {
                      new RegExp(source);
                      return false;
                    } catch {
                      return true;
                    }
                  });
                  if (invalid) {
                    setDraftInvalid(true);
                    return;
                  }
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
  compareUrl: string;
  setCompareUrl: (url: string) => void;
  onCompare: () => void;
  showIgnoreLines: boolean;
  ignorePatternText: string;
  setIgnorePatternText: (text: string) => void;
}>;

function CompareControls({
  compareState,
  compareUrl,
  setCompareUrl,
  onCompare,
  showIgnoreLines,
  ignorePatternText,
  setIgnorePatternText,
  className,
}: CompareControlsProps): JSX.Element {
  const t = useContext(TranslationContext);
  const onChange = (event: ChangeEvent<HTMLInputElement>) =>
    setCompareUrl(event.target.value);
  const isAccurate = compareState.isAccurate && compareState.url === compareUrl;
  const submitCompare = () => {
    if (compareUrl && !compareState.isLoading) onCompare();
  };

  return (
    <div className={classNames("flex items-center gap-2", className)}>
      <input
        className="border-input-background bg-input-background text-input-foreground placeholder-input-foreground/50 min-w-0 flex-1 rounded-sm border px-2 py-1 focus:outline-hidden"
        ref={focusCompareInput}
        placeholder={t.toolbar.compare.placeholder}
        value={compareUrl}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.stopPropagation();
          submitCompare();
        }}
      />

      <button
        className={classNames(
          "rounded-sm px-2 py-1 text-white enabled:hover:cursor-pointer disabled:opacity-50",
          isAccurate ? "bg-emerald-700" : "bg-red-700",
        )}
        onClick={submitCompare}
        disabled={!compareUrl || compareState.isLoading}
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
