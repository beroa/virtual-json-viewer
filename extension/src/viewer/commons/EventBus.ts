import * as Json from "@/viewer/commons/Json";

export enum ViewerEventType {
  Expand = "expand",
  Collapse = "collapse",
  SearchPreviewStarted = "search-preview-started",
  SearchPreviewCancelled = "search-preview-cancelled",
  SearchPreviewCommitted = "search-preview-committed",
  SearchFocusCurrentMatch = "search-focus-current-match",
  SearchNavigatePrevious = "search-navigate-previous",
  SearchNavigateNext = "search-navigate-next",
  EnterNode = "enter-node",
}

export interface ViewerEvent extends Event {}
export type ViewerEventScope = string;
export type ScopedViewerEvent = CustomEvent<{ scope?: ViewerEventScope }>;

export type NodePath = Json.Key[];

export class EnterNodeEvent extends Event implements ViewerEvent {
  constructor(public path: Json.Key[]) {
    super(ViewerEventType.EnterNode);
  }
}

export type ViewerComplexEventType = ViewerEventType.EnterNode;

export type ViewerSimpleEventType = Exclude<
  ViewerEventType,
  ViewerComplexEventType
>;

interface ViewerComplexEventMap {
  [ViewerEventType.EnterNode]: EnterNodeEvent;
}

export type ViewerEventListener<K extends ViewerEventType> = (
  event: K extends ViewerComplexEventType
    ? ViewerComplexEventMap[K]
    : ScopedViewerEvent,
) => void;

export function subscribe<K extends ViewerEventType>(
  type: K,
  listener: ViewerEventListener<K>,
): void {
  document.addEventListener(type, listener as EventListener);
}

export function unsubscribe<K extends ViewerEventType>(
  type: K,
  listener: ViewerEventListener<K>,
): void {
  document.removeEventListener(type, listener as EventListener);
}

export function dispatch(
  event: ViewerSimpleEventType | ViewerEvent,
  scope?: ViewerEventScope,
): void {
  if (typeof event === "string") {
    event = new CustomEvent(event, { detail: { scope } });
  }
  document.dispatchEvent(event);
}

export function shouldHandleViewerEvent(
  event: Nullable<Event>,
  scope?: ViewerEventScope,
): boolean {
  if (!event || !(event instanceof CustomEvent)) {
    return true;
  }

  return event.detail?.scope === undefined || event.detail.scope === scope;
}
