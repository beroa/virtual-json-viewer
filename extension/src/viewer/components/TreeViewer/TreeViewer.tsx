import { DiffByPath } from "@/viewer/commons/Diff";
import * as DOM from "@/viewer/commons/Dom";
import {
  shouldHandleViewerEvent,
  ViewerEventType,
} from "@/viewer/commons/EventBus";
import * as Json from "@/viewer/commons/Json";
import {
  CHORD_KEY,
  isUpperCaseKeypress,
  KeydownBufferEvent,
  KeydownEvent,
  SetValue,
  useEventBusListener,
  useGlobalKeydownEvent,
  useKeydownBuffer,
  useReactiveRef,
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
import { FullHeightScrollbar } from "./FullHeightScrollbar";
import { NodeId, RestoreSnapshotRequest, Tree, TreeHandler } from "./Tree";
import { TreeContext } from "./TreeContext";
import { TreeNavigator } from "./TreeNavigator";
import { TreeNode } from "./TreeNode";
import { treeWalker } from "./TreeWalker";

export type TreeViewerProps = Props<{
  jsonLines: Json.Lines;
  enableEnterNode: boolean;
  search: Search;
  setSearchNavigation: SetValue<SearchNavigation>;
  searchStartingIndex: number;
  showParentKeys?: boolean;
  viewerId?: string;
  diffByPath?: DiffByPath;
  onScrollElementChange?: (element: Nullable<HTMLElement>) => void;
}>;

type ParentKey = {
  key: Json.Key;
  nesting: number;
  nodeId: NodeId;
  progress: number;
  height: number;
};

export function TreeViewer({
  jsonLines,
  enableEnterNode,
  search,
  setSearchNavigation,
  searchStartingIndex,
  showParentKeys = true,
  viewerId = "main",
  diffByPath,
  onScrollElementChange,
  className,
}: TreeViewerProps): JSX.Element {
  // Single line -> shown on its own
  // Multiple lines -> shown as an array
  const json = useMemo(
    () => (jsonLines.length == 1 ? jsonLines[0] : jsonLines),
    [jsonLines],
  );

  const { expandNodes, indentation, sortKeys } = useContext(SettingsContext);

  // Tree walker for building the tree
  const walker = useMemo(
    () => treeWalker(json, search, expandNodes),
    [json, search, expandNodes],
  );

  // Imperative reference to manipulate the tree.
  // It changes when the content is (re)loaded.
  const [tree, treeRef] = useReactiveRef<TreeHandler>();
  const [parentKeys, setParentKeys] = useState<ParentKey[]>([]);
  const parentRowHeights = useRef(new Map<NodeId, number>());
  const [scrollElement, setScrollElementState] =
    useState<Nullable<HTMLElement>>(null);

  const setScrollElement = useCallback(
    (element: Nullable<HTMLElement>) => {
      onScrollElementChange?.(element);
      setScrollElementState(element);
    },
    [onScrollElementChange],
  );

  // Parent viewer element for focus and navigation
  const [parent, parentRef] = useReactiveRef<HTMLDivElement>();

  useEffect(() => {
    parentRowHeights.current.clear();
  }, [tree]);

  // Global events
  const expand = useCallback(() => tree?.openAll(), [tree]);
  useEventBusListener(ViewerEventType.Expand, expand);

  const collapse = useCallback(() => tree?.closeAll(), [tree]);
  useEventBusListener(ViewerEventType.Collapse, collapse);

  // Register global shortcut
  const handleShortcut = useCallback(
    (e: KeydownEvent) => {
      if (e[CHORD_KEY] && e.key === "0") {
        e.preventDefault();
        parent?.focus();
      }
    },
    [parent],
  );
  useGlobalKeydownEvent(handleShortcut);

  // Tree Navigator
  const updateParentKeys = useCallback(
    (fallbackIndex?: number) => {
      if (!tree || !scrollElement || !showParentKeys) {
        setParentKeys((current) => (current.length ? [] : current));
        return;
      }

      const viewport = scrollElement.getBoundingClientRect();
      const lineHeight =
        parseFloat(getComputedStyle(scrollElement).lineHeight) || 24;
      const rows = new Map<number, HTMLElement>();
      let firstVisibleIndex: number | undefined;
      for (const row of scrollElement.querySelectorAll<HTMLElement>(
        "[data-tree-index]",
      )) {
        const index = Number(row.dataset.treeIndex);
        rows.set(index, row);
        const rect = row.getBoundingClientRect();
        if (
          firstVisibleIndex === undefined &&
          rect.bottom > viewport.top &&
          rect.top < viewport.bottom
        ) {
          firstVisibleIndex = index;
        }
      }

      const index = firstVisibleIndex ?? fallbackIndex;
      if (index === undefined || index < 0 || index >= tree.length()) return;
      const node = tree.getByIndex(index);
      const keys: ParentKey[] = [];
      let ancestor: typeof node | null = node;
      while (ancestor) {
        if (ancestor.key !== null && ancestor.isOpen) {
          const row = rows.get(tree.indexById(ancestor.id));
          const rect = row?.getBoundingClientRect();
          if (rect) parentRowHeights.current.set(ancestor.id, rect.height);
          const progress = rect
            ? Math.max(0, Math.min(1, (viewport.top - rect.top) / rect.height))
            : 1;
          if (progress > 0) {
            keys.unshift({
              key: ancestor.key,
              nesting: ancestor.nesting,
              nodeId: ancestor.id,
              progress,
              height: parentRowHeights.current.get(ancestor.id) ?? lineHeight,
            });
          }
        }
        ancestor = ancestor.parent;
      }
      setParentKeys((current) =>
        current.length === keys.length &&
        current.every(
          (key, index) =>
            key.key === keys[index].key &&
            key.nesting === keys[index].nesting &&
            key.nodeId === keys[index].nodeId &&
            key.progress === keys[index].progress &&
            key.height === keys[index].height,
        )
          ? current
          : keys,
      );
    },
    [tree, scrollElement, showParentKeys],
  );

  const updateParentKeysForVisibleRow = useCallback(
    (index: number) => updateParentKeys(index),
    [updateParentKeys],
  );

  useEffect(() => {
    if (!scrollElement) return;
    const onScroll = () => updateParentKeys();
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
    };
  }, [scrollElement, updateParentKeys]);

  const treeNavigator = useMemo(
    () => new TreeNavigator(tree, parent),
    [tree, parent],
  );

  const snapshotRequestId = useRef(0);
  const searchPreviewActive = useRef(false);
  const previewSnapshot = useRef<
    RestoreSnapshotRequest["snapshot"] | undefined
  >(undefined);
  const [restoreSnapshotRequest, setRestoreSnapshotRequest] = useState<
    RestoreSnapshotRequest | undefined
  >(undefined);

  const saveSearchPreviewSnapshot = useCallback(() => {
    if (!searchPreviewActive.current) {
      previewSnapshot.current = treeNavigator.snapshot();
    }
    searchPreviewActive.current = true;
    treeNavigator.startSearchPreview();
  }, [treeNavigator]);
  useEventBusListener(
    ViewerEventType.SearchPreviewStarted,
    saveSearchPreviewSnapshot,
  );

  const restoreSearchPreviewSnapshot = useCallback(() => {
    searchPreviewActive.current = false;
    treeNavigator.cancelSearchPreview();
    if (!previewSnapshot.current) return;

    setRestoreSnapshotRequest({
      id: ++snapshotRequestId.current,
      snapshot: previewSnapshot.current,
    });
    previewSnapshot.current = undefined;
  }, [treeNavigator]);
  useEventBusListener(
    ViewerEventType.SearchPreviewCancelled,
    restoreSearchPreviewSnapshot,
  );

  const commitSearchPreview = useCallback(() => {
    searchPreviewActive.current = false;
    treeNavigator.commitSearchPreview();
    previewSnapshot.current = undefined;
  }, [treeNavigator]);
  useEventBusListener(
    ViewerEventType.SearchPreviewCommitted,
    commitSearchPreview,
  );

  const focusCurrentSearchMatch = useCallback(
    (event: Event) => {
      if (!shouldHandleViewerEvent(event, viewerId)) return;
      treeNavigator.focusCurrentSearchMatch();
    },
    [treeNavigator, viewerId],
  );
  useEventBusListener(
    ViewerEventType.SearchFocusCurrentMatch,
    focusCurrentSearchMatch,
  );

  const clearRestoreSnapshotRequest = useCallback(() => {
    if (restoreSnapshotRequest) {
      treeNavigator.restoreFocusedNode(restoreSnapshotRequest.snapshot);
      setRestoreSnapshotRequest(undefined);
    }
  }, [restoreSnapshotRequest, treeNavigator]);

  useEffect(() => {
    if (!search.text && !restoreSnapshotRequest) {
      searchPreviewActive.current = false;
      previewSnapshot.current = undefined;
    }
  }, [search.text, restoreSnapshotRequest]);

  // Keyboard navigation
  const navigate = useCallback(
    (e: KeydownBufferEvent) =>
      handleNavigation(parent, treeNavigator, e, {
        space: indentation,
        sortKeys,
      }),
    [parent, treeNavigator, indentation, sortKeys],
  );
  const onKeydown = useKeydownBuffer(navigate, {
    bufferSize: 2,
    keypressDelay: 500,
  });

  // Search navigation
  const goToPreviousMatch = useCallback(
    (event: Event) => {
      if (!shouldHandleViewerEvent(event, viewerId)) return;
      treeNavigator.goToPreviousSearchMatch();
    },
    [treeNavigator, viewerId],
  );
  useEventBusListener(
    ViewerEventType.SearchNavigatePrevious,
    goToPreviousMatch,
  );

  const goToNextMatch = useCallback(
    (event: Event) => {
      if (!shouldHandleViewerEvent(event, viewerId)) return;
      treeNavigator.goToNextSearchMatch();
    },
    [treeNavigator, viewerId],
  );
  useEventBusListener(ViewerEventType.SearchNavigateNext, goToNextMatch);

  // Enable search navigation when search is active
  // Starting index is not a dependency, because it must not trigger a reset.
  useEffect(() => {
    // Micro-optimization: avoid O(N) scan if search is not active
    // No search dependency, because the navigator is rebuilt when search changes
    if (!search.text) return;
    treeNavigator.enableSearchNavigation(
      setSearchNavigation,
      searchStartingIndex,
      searchPreviewActive.current,
    );
  }, [treeNavigator]);

  // Tree context for nodes
  const context: TreeContext = useMemo(
    () => ({ tree: treeNavigator, enableEnterNode, viewerId, diffByPath }),
    [treeNavigator, enableEnterNode, viewerId, diffByPath],
  );

  const pinnedHeight = parentKeys.reduce(
    (height, key) => height + key.height * key.progress,
    0,
  );

  // Wrap the Tree in a div to handle resize, focus and navigation
  return (
    <div
      ref={parentRef}
      className={classNames(
        className,
        "focus:outline-viewer-foreground relative flex h-full flex-col overflow-hidden focus:outline-1 focus:-outline-offset-1 focus:outline-solid",
      )}
      tabIndex={0}
      onKeyDown={onKeydown}
    >
      {showParentKeys && parentKeys.length > 0 && (
        <div
          className="bg-viewer-background text-json-key z-10 shrink-0 overflow-hidden shadow-sm"
          style={{ height: pinnedHeight }}
        >
          {parentKeys.map(({ key, nesting, nodeId, progress, height }) => (
            <div
              key={nodeId}
              className="overflow-hidden"
              style={{ height: height * progress }}
            >
              <button
                type="button"
                className="block w-full text-left whitespace-pre-wrap hover:underline"
                style={{
                  paddingLeft: `calc(${nesting}em + 1.375rem)`,
                }}
                onClick={() => tree?.scrollTo(nodeId, "start")}
              >
                {key}:
              </button>
            </div>
          ))}
        </div>
      )}
      <FullHeightScrollbar scrollElement={scrollElement} />
      <div className="min-h-0 flex-1">
        <Tree
          treeWalker={walker}
          ref={treeRef}
          context={context}
          restoreSnapshotRequest={restoreSnapshotRequest}
          onRestoreSnapshotApplied={clearRestoreSnapshotRequest}
          onScrollElementChange={setScrollElement}
          onVisibleRowChange={updateParentKeysForVisibleRow}
        >
          {TreeNode}
        </Tree>
      </div>
    </div>
  );
}

function handleNavigation(
  treeElem: Nullable<HTMLElement>,
  tree: TreeNavigator,
  { last: e, text }: KeydownBufferEvent,
  copyOptions: Json.ToStringOptions,
) {
  function from(navigate: (id: NodeId) => void) {
    const id = tree.getCurrentId();
    if (id !== undefined) navigate(id);
  }

  // Focus

  if (e.key == "Enter") {
    e.preventDefault();
    from((id) => tree.goto(id));
    return;
  }

  if (e.key == "Escape") {
    e.preventDefault();
    treeElem?.focus();
    DOM.deselectAllText();
    return;
  }

  // Row navigation

  if (e.key == "ArrowDown" || e.key == "j") {
    e.preventDefault();
    from((id) =>
      e.repeat
        ? tree.gotoRepeatedRowsOffset(id, 1)
        : tree.gotoRowsOffset(id, 1),
    );
    return;
  }

  if (e.key == "ArrowUp" || e.key == "k") {
    e.preventDefault();
    from((id) =>
      e.repeat
        ? tree.gotoRepeatedRowsOffset(id, -1)
        : tree.gotoRowsOffset(id, -1),
    );
    return;
  }

  // Page navigation

  if (e.key == "PageDown" || isUpperCaseKeypress(e, "J")) {
    e.preventDefault();
    from((id) => tree.gotoPagesOffset(id, 1));
    return;
  }

  if (e.key == "PageUp" || isUpperCaseKeypress(e, "K")) {
    e.preventDefault();
    from((id) => tree.gotoPagesOffset(id, -1));
    return;
  }

  if (e.key == "Home" || text.slice(-2) == "gg") {
    e.preventDefault();
    tree.gotoFirst();
    return;
  }

  if (e.key == "End" || isUpperCaseKeypress(e, "G")) {
    e.preventDefault();
    tree.gotoLast();
    return;
  }

  if (e.key == "\\") {
    e.preventDefault();
    from((id) => tree.gotoObjectBoundary(id));
    return;
  }

  if (e.key == "y") {
    e.preventDefault();
    copyCurrentJsonBlock(tree, copyOptions);
    return;
  }

  // Open state

  if (e.key == "ArrowRight" || e.key == "l") {
    e.preventDefault();
    from((id) => tree.open(id));
    return;
  }

  if (e.key == "ArrowLeft" || e.key == "h") {
    e.preventDefault();
    from((id) => tree.close(id));
    return;
  }

  if (e.key == " ") {
    e.preventDefault();
    from((id) => tree.toggleOpen(id));
    return;
  }
}

function copyCurrentJsonBlock(tree: TreeNavigator, opts: Json.ToStringOptions) {
  const value = tree.getCurrentBlockValue();
  if (value === undefined) return;

  const text = Json.toString(value, opts);
  navigator.clipboard?.writeText(text);
}
