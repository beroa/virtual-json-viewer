import { dispatch, ViewerEventType } from "@/viewer/commons/EventBus";
import { Search, SearchNavigation } from "@/viewer/state";
import classNames from "classnames";
import {
  Dispatch,
  JSX,
  SetStateAction,
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
}>;

export function SearchBox({
  className,
  search,
  setSearch,
  navigation,
  enableVisibility,
}: SearchBoxProps): JSX.Element {
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
        enableTreeEscape={enableVisibility}
        isCommitted={isCommitted}
        isSearchCommitted={() => isCommittedRef.current}
        hasSelectedMatch={navigation.currentIndex !== null}
        text={search.text}
        setText={setSearchText}
        clearPreview={clearPreview}
        commitSearch={commitSearch}
      />

      {search.text && (
        <SearchNavigationPanel
          className="mx-3 h-6"
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
    </span>
  );
}
