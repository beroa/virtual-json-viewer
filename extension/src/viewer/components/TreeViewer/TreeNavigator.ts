import { SearchMatchHandler } from "@/viewer/components/RenderedText";
import { RefCurrent } from "@/viewer/hooks";
import { SearchNavigation } from "@/viewer/state";
import { NodeId, TreeHandler, TreeSnapshot } from "./Tree";

export enum NodePart {
  Key = "key",
  Value = "value",
}

export interface TreeNavigatorNodeHandler {
  focus(): void;
  blur(): void;
  setAnchored(anchored: boolean): void;
  listenOnFocus(callback: () => void): void;
  getMatchHandler(
    part: NodePart,
    index: number,
  ): SearchMatchHandler | undefined;
}

export type SearchNavigationCallback = (navigation: SearchNavigation) => void;

type FlattenedSearchMatch = {
  nodeId: NodeId;
  nodePart: NodePart;
  index: number;
};

export class TreeNavigator {
  private tree: RefCurrent<TreeHandler>;
  private treeElem: RefCurrent<HTMLElement>;

  // Nodes navigation
  private handlerById: Map<NodeId, TreeNavigatorNodeHandler> = new Map();
  private lastFocused?: NodeId;

  // Search navigation
  private searchMatches: FlattenedSearchMatch[] = [];
  private searchIndex: Nullable<number> = null;
  private searchPreview = false;
  private onSearchNavigation?: SearchNavigationCallback;

  constructor(
    tree: RefCurrent<TreeHandler>,
    treeElem: RefCurrent<HTMLElement>,
  ) {
    this.tree = tree;
    this.treeElem = treeElem;
  }

  // Nodes lifecycle

  public onNodeShown(id: NodeId, handler: TreeNavigatorNodeHandler) {
    this.handlerById.set(id, handler);

    // Listen to external focus event (e.g. by mouse click)
    handler.listenOnFocus(() => this.setAnchor(id));

    if (this.lastFocused === undefined) {
      this.setAnchor(this.getCurrentId());
    }

    // Handle pending navigation
    if (id === this.lastFocused) {
      this.trySetAnchorCurrent(true);
    }

    // Handle previous search match selection
    const searchNodeId = this.searchMatches[this.searchIndex ?? -1]?.nodeId;
    if (id === searchNodeId) {
      this.trySelectCurrentSearchMatch();
    }
  }

  public onNodeHidden(id: NodeId) {
    // return focus to parent to avoid inconsistencies
    if (id === this.lastFocused && this.hasTreeFocus()) {
      this.tryBlurCurrent();
      this.treeElem?.focus();
    }

    this.handlerById.delete(id);
  }

  // Openness

  public toggleOpen(id: NodeId) {
    this.tree?.setOpen(id, !this.tree?.isOpen(id));
  }

  public open(id: NodeId) {
    this.tree?.setOpen(id, true);
  }

  public close(id: NodeId) {
    if (this.tree?.isOpen(id)) {
      this.tree?.setOpen(id, false);
      return;
    }

    // if already closed and it has a parent, then close the parent
    const parentId = this.tree?.get(id).parent?.id;
    if (parentId !== undefined) {
      this.goto(parentId);
      this.close(parentId);
    }
  }

  // Nodes navigation

  public gotoRowsOffset(id: NodeId, rows: number) {
    const index = this.tree?.indexById(id);
    if (index !== undefined) {
      this.gotoIndex(index + rows);
    }
  }

  public gotoPagesOffset(id: NodeId, pages: number) {
    const index = this.tree?.indexById(id);
    if (index !== undefined) {
      this.gotoIndex(index + pages * this.pageRows());
    }
  }

  public gotoFirst() {
    this.gotoIndex(0);
  }

  public gotoLast() {
    if (!this.tree?.length()) return;
    this.gotoIndex(this.tree.length() - 1);
  }

  public gotoObjectBoundary(id: NodeId) {
    const container = this.findBoundaryContainer(id);
    if (!container?.children.length) return;

    const firstChild = container.children[0];
    const lastChild = container.children[container.children.length - 1];
    const target = id === firstChild.id ? lastChild : firstChild;

    this.open(container.id);
    this.goto(target.id);
  }

  public getCurrentId(): NodeId | undefined {
    if (
      this.lastFocused !== undefined &&
      this.tree?.indexById(this.lastFocused) !== -1
    ) {
      return this.lastFocused;
    }

    if (this.tree?.length()) {
      this.setAnchor(this.tree.getByIndex(0).id);
      return this.lastFocused;
    }
  }

  public snapshot(): TreeSnapshot | undefined {
    return this.tree?.snapshot(this.lastFocused);
  }

  public restoreFocusedNode(snapshot: TreeSnapshot) {
    if (!snapshot.focusedWalkId) return;

    const id = this.tree?.idByWalkId(snapshot.focusedWalkId);
    if (id !== undefined) {
      this.setAnchor(id);
    }
  }

  public goto(id: NodeId) {
    // manually mark the node as focused, because
    // the target html element could be outside the virtual list
    this.setAnchor(id);

    this.tree?.scrollTo(id);
    this.tryFocusCurrent();
  }

  private setAnchor(id: NodeId | undefined) {
    if (id === undefined) return;
    if (this.lastFocused === id) {
      this.trySetAnchorCurrent(true);
      return;
    }

    this.handlerById.get(this.lastFocused ?? -1)?.setAnchored(false);
    this.lastFocused = id;
    this.trySetAnchorCurrent(true);
  }

  private trySetAnchorCurrent(anchored: boolean) {
    if (this.lastFocused === undefined) return;
    this.handlerById.get(this.lastFocused)?.setAnchored(anchored);
  }

  private tryFocusCurrent() {
    if (this.lastFocused === undefined) return;
    this.handlerById.get(this.lastFocused)?.focus();
  }

  private focusTreeElement() {
    this.treeElem?.focus();
  }

  private hasTreeFocus(): boolean {
    const treeElem = this.treeElem;
    const activeElement = document.activeElement;
    return !!treeElem && !!activeElement && treeElem.contains(activeElement);
  }

  private tryBlurCurrent() {
    if (this.lastFocused === undefined) return;
    this.handlerById.get(this.lastFocused)?.blur();
  }

  private gotoIndex(index: number) {
    if (!this.tree?.length()) return;
    index = Math.max(0, Math.min(index, this.tree.length() - 1));
    const id = this.tree.getByIndex(index).id;
    this.goto(id);
  }

  private findBoundaryContainer(id: NodeId) {
    const node = this.tree?.get(id);
    if (!node) return;

    if (!node.isLeaf) {
      return node;
    }

    return node.parent ?? undefined;
  }

  private pageRows(): number {
    const listElem = this.treeElem?.firstElementChild;
    const pageHeight = listElem?.clientHeight;
    const rowHeight = listElem?.firstElementChild?.clientHeight;
    return pageHeight && rowHeight ? Math.ceil(pageHeight / rowHeight) : 1;
  }

  // Search navigation

  public enableSearchNavigation(
    callback: SearchNavigationCallback,
    searchStartingIndex: number,
    searchPreview: boolean,
  ) {
    if (!this.tree) return;
    this.onSearchNavigation = callback;
    this.searchMatches = flattenSearchMatches(this.tree);
    this.searchPreview = searchPreview;

    if (this.searchMatches.length) {
      this.goToSearchIndex(searchStartingIndex);
    } else {
      this.notifySearchNavigation();
    }
  }

  public setSearchPreview(searchPreview: boolean) {
    this.searchPreview = searchPreview;
  }

  public startSearchPreview() {
    this.searchPreview = true;
    this.trySelectCurrentSearchMatch();
  }

  public commitSearchPreview() {
    this.searchPreview = false;
    this.trySelectCurrentSearchMatch();
  }

  public cancelSearchPreview() {
    this.searchPreview = false;
  }

  public goToPreviousSearchMatch() {
    if (!this.searchMatches.length) return;
    const previous = (this.searchIndex || this.searchMatches.length) - 1;
    this.goToSearchIndex(previous);
  }

  public goToNextSearchMatch() {
    if (!this.searchMatches.length) return;
    const next = ((this.searchIndex ?? -1) + 1) % this.searchMatches.length;
    this.goToSearchIndex(next);
  }

  public goToSearchIndex(index: number) {
    // Defensive boundaries check
    if (!this.tree?.length()) return;
    index = Math.max(0, Math.min(index, this.searchMatches.length - 1));
    const preserveTreeFocus = this.hasTreeFocus();

    // Deselect previous match
    if (this.searchIndex !== null) {
      this.getSearchHandler(this.searchIndex)?.setSelected(false);
    }

    // Update current index
    this.searchIndex = index;

    // Blur the current node if it was focused
    this.tryBlurCurrent();

    // Go to the next node
    const nodeId = this.searchMatches[index]!.nodeId;
    this.tree?.scrollTo(nodeId, "center");

    // Select the match inside the node
    this.trySelectCurrentSearchMatch();

    if (preserveTreeFocus) {
      this.setAnchor(nodeId);
      this.tryFocusCurrent();
      setTimeout(() => this.tryFocusCurrent());
    } else {
      this.setAnchor(nodeId);
    }

    // Notify the change
    this.notifySearchNavigation();
  }

  public focusCurrentSearchMatch() {
    const nodeId = this.searchMatches[this.searchIndex ?? -1]?.nodeId;
    if (nodeId === undefined) return;

    this.setAnchor(nodeId);
    this.tree?.scrollTo(nodeId, "center");
    this.focusTreeElement();
    this.tryFocusCurrent();
    setTimeout(() => this.tryFocusCurrent());
  }

  private trySelectCurrentSearchMatch() {
    if (this.searchIndex === null) return;
    if (this.searchPreview) return;
    const handler = this.getSearchHandler(this.searchIndex);
    handler?.setSelected(true);
  }

  private getSearchHandler(index: number): SearchMatchHandler | undefined {
    const match = this.searchMatches[index];
    if (!match) return undefined;
    return this.handlerById
      .get(match.nodeId)
      ?.getMatchHandler(match.nodePart, match.index);
  }

  private notifySearchNavigation() {
    if (this.onSearchNavigation) {
      this.onSearchNavigation({
        currentIndex: this.searchIndex,
        totalCount: this.searchMatches.length,
      });
    }
  }
}

function flattenSearchMatches(tree: TreeHandler): FlattenedSearchMatch[] {
  return tree
    .iterAll()
    .flatMap((node) => {
      if (!node.searchMatch) return [];

      return [
        ...node.searchMatch.keyMatches.map((_match, index) => ({
          nodeId: node.id,
          nodePart: NodePart.Key,
          index,
        })),
        ...node.searchMatch.valueMatches.map((_match, index) => ({
          nodeId: node.id,
          nodePart: NodePart.Value,
          index,
        })),
      ];
    })
    .toArray();
}
