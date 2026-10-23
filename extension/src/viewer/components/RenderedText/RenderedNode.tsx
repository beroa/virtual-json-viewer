import { JSX } from "react";
import { DiffText, DIFF_TYPE, DiffMatch } from "./DiffText";
import { LINK_TYPE, LinkifiedText, LinkMatch } from "./LinkifiedText";
import { SearchMatchHandler } from "./Renderer";
import {
  SEARCH_TYPE,
  SearchedText,
  SearchedTextHandler,
  SearchMatch,
} from "./SearchedText";

export type AnyMatch = DiffMatch | SearchMatch | LinkMatch;

export type RenderedNode = string | JSX.Element;

export class NodeBuilder {
  private searchMatches: SearchMatchHandler[];
  private buildDiffNode: DiffNodeBuilder;
  private buildSearchNode: SearchNodeBuilder;
  private buildLinkNode: LinkNodeBuilder;

  constructor() {
    this.buildDiffNode = buildDiffNode;
    [this.searchMatches, this.buildSearchNode] = searchNodeBuilder();
    this.buildLinkNode = buildLinkNode;
  }

  public fromMatch(match: AnyMatch, children: RenderedNode[]): RenderedNode {
    switch (match.type) {
      case DIFF_TYPE:
        return this.buildDiffNode(match, children);

      case SEARCH_TYPE:
        return this.buildSearchNode(match, children);

      case LINK_TYPE:
        return this.buildLinkNode(match, children);
    }
  }

  public getSearchMatches(): SearchMatchHandler[] {
    return this.searchMatches;
  }
}

type DiffNodeBuilder = (
  match: DiffMatch,
  children: RenderedNode[],
) => RenderedNode;

function buildDiffNode(
  match: DiffMatch,
  children: RenderedNode[],
): RenderedNode {
  return (
    <DiffText key={match.id} kind={match.metadata.kind}>
      {children}
    </DiffText>
  );
}

type SearchNodeBuilder = (
  match: SearchMatch,
  children: RenderedNode[],
) => RenderedNode;

class CollapsedSearchMatchHandler implements SearchMatchHandler {
  private nodeHandlers: SearchedTextHandler[] = [];

  public add(handler: SearchedTextHandler): void {
    this.nodeHandlers.push(handler);
  }

  public setSelected(selected: boolean): void {
    // mark all nodes as selected
    this.nodeHandlers.forEach((handler) => handler.setSelected(selected));
  }

  public scrollIntoView(): void {
    // scroll into view the first node
    this.nodeHandlers[0]?.scrollIntoView();
  }
}

function searchNodeBuilder(): [SearchMatchHandler[], SearchNodeBuilder] {
  // References array to keep search matches node handlers.
  // They start as placeholders and are resolved on rendering.
  const searchMatches: CollapsedSearchMatchHandler[] = [];

  // A search match can be split in multiple nodes,
  // this keeps track of the last match id to expose a single handler
  // for all consecuting nodes of the same match.
  let lastMatchId: Nullable<string> = null;

  function newSearchMatchRefCallback(id: string) {
    const isNewNode = lastMatchId !== id;
    if (isNewNode) {
      searchMatches.push(new CollapsedSearchMatchHandler());
      lastMatchId = id;
    }

    const index = searchMatches.length - 1;

    return (handler: SearchedTextHandler) => {
      searchMatches[index].add(handler);
    };
  }

  function buildSearchNode(
    match: SearchMatch,
    children: RenderedNode[],
  ): RenderedNode {
    return (
      <SearchedText key={match.id} ref={newSearchMatchRefCallback(match.id)}>
        {children}
      </SearchedText>
    );
  }

  return [searchMatches, buildSearchNode];
}

type LinkNodeBuilder = (
  match: LinkMatch,
  children: RenderedNode[],
) => RenderedNode;

function buildLinkNode(
  match: LinkMatch,
  children: RenderedNode[],
): RenderedNode {
  return (
    <LinkifiedText key={match.id} {...match.metadata}>
      {children}
    </LinkifiedText>
  );
}
