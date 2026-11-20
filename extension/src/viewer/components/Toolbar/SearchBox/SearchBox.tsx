import { dispatch, ViewerEventType } from "@/viewer/commons/EventBus";
import { isValidSearchRegex } from "@/viewer/commons/Searcher";
import { Icon } from "@/viewer/components";
import { TranslationContext } from "@/viewer/localization";
import { Search, SearchNavigation } from "@/viewer/state";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { SearchClearButton } from "./SearchClearButton";
import { SearchInput } from "./SearchInput";
import { SearchNavigationPanel } from "./SearchNavigationPanel";
import { SearchSensitivityToggle } from "./SearchSensitivityButton";
import { SearchVisibilityToggle } from "./SearchVisibilityButton";

export type SearchBoxProps = Props<{
  search: Search;
  setSearch: Dispatch<SetStateAction<Search>>;
  navigation: SearchNavigation;
  enableVisibility: boolean;
  viewerId?: string;
}>;

export function SearchBox({
  className,
  search,
  setSearch,
  navigation,
  enableVisibility,
  viewerId,
}: SearchBoxProps): JSX.Element {
  const t = useContext(TranslationContext);
  const invalidRegex = !!search.regex && !isValidSearchRegex(search.text);
  const isCommittedRef = useRef(false);
  const [isCommitted, setIsCommitted] = useState(false);

  useEffect(() => {
    if (!search.text) {
      isCommittedRef.current = false;
      setIsCommitted(false);
    }
  }, [search.text]);

  function updateSearch(update: Partial<Search>) {
    setSearch((prevSearch) => ({ ...prevSearch, ...update }));
  }

  function setSearchText(text: string) {
    if (text && (!search.text || isCommittedRef.current)) {
      dispatch(ViewerEventType.SearchPreviewStarted);
    }

    if (text !== search.text) {
      isCommittedRef.current = false;
      setIsCommitted(false);
    }

    updateSearch({ text });
  }

  function clearSearch() {
    updateSearch({ text: "" });
    isCommittedRef.current = false;
    setIsCommitted(false);
  }

  function clearPreview() {
    dispatch(ViewerEventType.SearchPreviewCancelled);
    clearSearch();
  }

  function commitSearch() {
    dispatch(ViewerEventType.SearchPreviewCommitted);
    isCommittedRef.current = true;
    setIsCommitted(true);
  }

  return (
    <span
      className={classNames(
        "border-input-background bg-input-background text-input-foreground flex items-center rounded-sm border pr-1",
        className,
      )}
    >
      <SearchClearButton
        className="mr-2 ml-1 h-5 w-5"
        isEmpty={search.text === ""}
        clearSearch={clearSearch}
      />

      <SearchInput
        className="flex-1 bg-inherit"
        viewerId={viewerId}
        enableTreeEscape={enableVisibility}
        isCommitted={isCommitted}
        isSearchCommitted={() => isCommittedRef.current}
        hasSelectedMatch={navigation.currentIndex !== null}
        text={search.text}
        setText={setSearchText}
        clearPreview={clearPreview}
        commitSearch={commitSearch}
        toggleWholeWord={() => updateSearch({ wholeWord: !search.wholeWord })}
        toggleRegex={() => updateSearch({ regex: !search.regex })}
        invalidRegex={invalidRegex}
      />
      {invalidRegex && (
        <span
          className="text-red-500"
          role="alert"
          title={t.toolbar.search.invalidRegex}
        >
          !<span className="sr-only">{t.toolbar.search.invalidRegex}</span>
        </span>
      )}

      {search.text && (
        <SearchNavigationPanel
          className="mx-3 h-6"
          viewerId={viewerId}
          currentIndex={navigation.currentIndex}
          isCommitted={isCommitted}
          commitSearch={commitSearch}
          totalCount={navigation.totalCount}
        />
      )}

      {enableVisibility && (
        <SearchVisibilityToggle
          className="h-6 w-6"
          visibility={search.visibility}
          setVisibility={(visibility) => updateSearch({ visibility })}
        />
      )}

      <SearchSensitivityToggle
        className="ml-1 h-6 w-6"
        caseSensitive={search.caseSensitive}
        setCaseSensitive={(caseSensitive) => updateSearch({ caseSensitive })}
      />
      <button
        type="button"
        className={classNames(
          "fill-input-foreground hover:bg-input-focus ml-1 h-6 w-6 rounded-sm enabled:hover:cursor-pointer",
          { "bg-input-focus": search.wholeWord },
        )}
        title={t.toolbar.search.wholeWord}
        aria-label={t.toolbar.search.wholeWord}
        aria-pressed={!!search.wholeWord}
        onClick={() => updateSearch({ wholeWord: !search.wholeWord })}
      >
        <Icon.WholeWord />
      </button>
      <button
        type="button"
        className={classNames(
          "fill-input-foreground hover:bg-input-focus ml-1 h-6 w-6 rounded-sm enabled:hover:cursor-pointer",
          { "bg-input-focus": search.regex },
        )}
        title={t.toolbar.search.regex}
        aria-label={t.toolbar.search.regex}
        aria-pressed={!!search.regex}
        onClick={() => updateSearch({ regex: !search.regex })}
      >
        <Icon.Regex />
      </button>
    </span>
  );
}
