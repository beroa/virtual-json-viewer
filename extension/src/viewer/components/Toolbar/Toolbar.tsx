import * as Json from "@/viewer/commons/Json";
import { StateObject } from "@/viewer/hooks";
import { TranslationContext } from "@/viewer/localization";
import {
  JQCommand,
  Search,
  SearchNavigation,
  ViewerMode,
} from "@/viewer/state";
import classNames from "classnames";
import { ChangeEvent, Dispatch, JSX, SetStateAction, useContext } from "react";
import { Icon, IconButton } from "@/viewer/components";
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
          className={classNames(
            "fill-toolbar-foreground h-6 w-6",
            {
              "hover:bg-toolbar-focus": isTreeView && !showParentKeys,
              "bg-toolbar-focus": isTreeView && showParentKeys,
            },
          )}
          title={
            showParentKeys
              ? t.toolbar.parents.hide
              : t.toolbar.parents.show
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
            onClick={() => setCompareControlsVisible((visible) => !visible)}
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

function Separator(): JSX.Element {
  return <div className="border-toolbar-foreground/75 mx-2 h-3/4 border-l" />;
}

type CompareControlsProps = Props<{
  compareState: CompareState;
  setCompareUrl: (url: string) => void;
  onCompare: () => void;
  onClearCompare: () => void;
}>;

function CompareControls({
  compareState,
  setCompareUrl,
  onCompare,
  onClearCompare,
  className,
}: CompareControlsProps): JSX.Element {
  const t = useContext(TranslationContext);
  const onChange = (event: ChangeEvent<HTMLInputElement>) =>
    setCompareUrl(event.target.value);

  return (
    <div className={classNames("flex items-center gap-2", className)}>
      <input
        className="border-input-background bg-input-background text-input-foreground placeholder-input-foreground/50 min-w-0 flex-1 rounded-sm border px-2 py-1 focus:outline-hidden"
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

      {compareState.isDiffMode && (
        <button
          className="text-toolbar-foreground rounded-sm border border-transparent px-2 py-1 enabled:hover:cursor-pointer enabled:hover:border-toolbar-foreground/25"
          onClick={onClearCompare}
        >
          {t.toolbar.compare.clear}
        </button>
      )}

      {compareState.error && (
        <span className="text-red-300 text-sm">{compareState.error}</span>
      )}
    </div>
  );
}
