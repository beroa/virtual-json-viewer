import { isActiveElementEditable } from "@/viewer/commons/Dom";
import { dispatch, ViewerEventType } from "@/viewer/commons/EventBus";
import { Icon, IconButton } from "@/viewer/components";
import {
  CHORD_KEY,
  isUpperCaseKeypress,
  KeydownEvent,
  useGlobalKeydownEvent,
} from "@/viewer/hooks";
import { TranslationContext } from "@/viewer/localization";
import classNames from "classnames";
import { JSX, useCallback, useContext } from "react";

export type SearchNavigationPanelProps = Props<{
  currentIndex: Nullable<number>;
  isCommitted: boolean;
  commitSearch: () => void;
  totalCount: number;
}>;

export function SearchNavigationPanel({
  className,
  currentIndex,
  isCommitted,
  commitSearch,
  totalCount,
}: SearchNavigationPanelProps): JSX.Element {
  const t = useContext(TranslationContext);

  const handleShortcut = useCallback(
    (e: KeydownEvent) => {
      if (
        (e[CHORD_KEY] && isUpperCaseKeypress(e, "g")) ||
        (isUpperCaseKeypress(e, "n") && !isActiveElementEditable())
      ) {
        e.preventDefault();
        commitSearch();
        dispatch(ViewerEventType.SearchNavigatePrevious);
        return;
      }

      if (
        (e[CHORD_KEY] && e.key === "g") ||
        (e.key === "n" && !isActiveElementEditable())
      ) {
        e.preventDefault();
        commitSearch();
        dispatch(ViewerEventType.SearchNavigateNext);
        return;
      }
    },
    [commitSearch],
  );
  useGlobalKeydownEvent(handleShortcut);

  const displayIndex = isCommitted ? (currentIndex ?? -1) + 1 : "?";

  const buttonDisabled = totalCount === 0;
  const buttonClassName =
    "h-full w-6 disabled:fill-input-foreground/50 enabled:fill-input-foreground enabled:hover:bg-input-focus";

  const navigatePrevious = () => {
    commitSearch();
    dispatch(ViewerEventType.SearchNavigatePrevious);
  };

  const navigateNext = () => {
    commitSearch();
    dispatch(ViewerEventType.SearchNavigateNext);
  };

  return (
    <span className={classNames("flex items-center gap-0.5", className)}>
      <span className="text-input-foreground/75 mr-1 text-nowrap select-none">
        {displayIndex}/{totalCount}
      </span>

      <IconButton
        className={buttonClassName}
        title={t.toolbar.search.navigation.previous}
        disabled={buttonDisabled}
        icon={Icon.ChevronUp}
        onClick={navigatePrevious}
      />

      <IconButton
        className={buttonClassName}
        title={t.toolbar.search.navigation.next}
        disabled={buttonDisabled}
        icon={Icon.ChevronDown}
        onClick={navigateNext}
      />
    </span>
  );
}
