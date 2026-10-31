import { JSX, useLayoutEffect, useRef } from "react";

/** A native scrollbar spanning the panel while the tree keeps its own viewport. */
export function FullHeightScrollbar({
  scrollElement,
}: {
  scrollElement: Nullable<HTMLElement>;
}): JSX.Element {
  const railRef = useRef<HTMLDivElement>(null);
  const extentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const extent = extentRef.current;
    if (!scrollElement || !rail || !extent) return;

    const syncFromTree = () => {
      const width = `${Math.max(16, scrollElement.offsetWidth - scrollElement.clientWidth)}px`;
      if (rail.style.width !== width) rail.style.width = width;
      // Match the scroll distance, not the content height: the rail includes
      // the pinned strip, so its viewport is taller than the tree's viewport.
      const height = `${rail.clientHeight + scrollElement.scrollHeight - scrollElement.clientHeight}px`;
      if (extent.style.height !== height) extent.style.height = height;
      if (rail.scrollTop !== scrollElement.scrollTop) {
        rail.scrollTop = scrollElement.scrollTop;
      }
    };
    const syncFromRail = () => {
      if (scrollElement.scrollTop !== rail.scrollTop) {
        scrollElement.scrollTop = rail.scrollTop;
      }
    };
    const resize = new ResizeObserver(syncFromTree);
    resize.observe(rail);
    resize.observe(scrollElement);
    // Virtualized rows change the scroll extent without resizing the viewport.
    const content = new MutationObserver(syncFromTree);
    content.observe(scrollElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    scrollElement.addEventListener("scroll", syncFromTree, { passive: true });
    rail.addEventListener("scroll", syncFromRail, { passive: true });
    syncFromTree();
    return () => {
      resize.disconnect();
      content.disconnect();
      scrollElement.removeEventListener("scroll", syncFromTree);
      rail.removeEventListener("scroll", syncFromRail);
    };
  }, [scrollElement]);

  return (
    <div
      ref={railRef}
      aria-hidden="true"
      tabIndex={-1}
      className="bg-viewer-background absolute top-0 right-0 bottom-0 z-20 overflow-x-hidden overflow-y-scroll"
      style={{ width: 16 }}
    >
      <div ref={extentRef} style={{ width: 1 }} />
    </div>
  );
}
