import { isActiveElementEditable } from "@/viewer/commons/Dom";
import { dispatch, ViewerEventType } from "@/viewer/commons/EventBus";
import {
  CHORD_KEY,
  KeydownEvent,
  useGlobalKeydownEvent,
  useReactiveRef,
} from "@/viewer/hooks";
import { TranslationContext } from "@/viewer/localization";
import { SettingsContext } from "@/viewer/state";
import classNames from "classnames";
import {
  FormEvent,
  JSX,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

type SearchInputProps = Props<{
  viewerId?: string;
  enableTreeEscape: boolean;
  isCommitted: boolean;
  isSearchCommitted: () => boolean;
  hasSelectedMatch: boolean;
  text: string;
  setText: (text: string) => void;
  clearPreview: () => void;
  commitSearch: () => void;
  toggleWholeWord: () => void;
  toggleRegex: () => void;
  invalidRegex: boolean;
}>;

export function SearchInput({
  viewerId,
  enableTreeEscape,
  isCommitted,
  isSearchCommitted,
  hasSelectedMatch,
  text,
  setText,
  clearPreview,
  commitSearch,
  toggleWholeWord,
  toggleRegex,
  invalidRegex,
  className,
}: SearchInputProps): JSX.Element {
  const t = useContext(TranslationContext);
  const { searchDelay } = useContext(SettingsContext);

  const [current, ref] = useReactiveRef<HTMLInputElement>();

  // debounce onChange event to wait until user stops typing
  const timeoutId = useRef<Nullable<NodeJS.Timeout>>(null);
  const previousText = useRef(text);

  // Do not overwrite edits that have not yet reached the debounced search state.
  useEffect(() => {
    if (!text && previousText.current && timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    previousText.current = text;
    if (current && !timeoutId.current) current.value = text;
  }, [current, text]);

  const maybeClearTimeout = () => {
    if (timeoutId.current) clearTimeout(timeoutId.current);
    timeoutId.current = null;
  };

  // clear timeout on component unmount
  useEffect(() => maybeClearTimeout, []);

  // automatically submit the search when the text changes
  const onChange = (e: FormEvent<HTMLInputElement>) => {
    maybeClearTimeout();
    const text = (e.target as HTMLInputElement).value;
    timeoutId.current = setTimeout(() => {
      timeoutId.current = null;
      setText(text);
    }, searchDelay);
  };

  function flushText(): [text: string, changed: boolean] {
    maybeClearTimeout();
    const nextText = current?.value ?? "";
    const changed = nextText !== text;
    if (changed) {
      setText(nextText);
    }
    return [nextText, changed];
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      e.key.toLowerCase() === "w"
    ) {
      e.preventDefault();
      toggleWholeWord();
      return;
    }
    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      e.key.toLowerCase() === "r"
    ) {
      e.preventDefault();
      toggleRegex();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const [nextText, textChanged] = flushText();
      if (!nextText) return;

      if (isCommitted && !textChanged) {
        dispatch(
          e.shiftKey
            ? ViewerEventType.SearchNavigatePrevious
            : ViewerEventType.SearchNavigateNext,
          viewerId,
        );
      } else {
        commitSearch();
      }
      return;
    }

    if (e.key === "Escape" && enableTreeEscape) {
      e.preventDefault();
      maybeClearTimeout();

      if (isSearchCommitted() && hasSelectedMatch) {
        dispatch(ViewerEventType.SearchFocusCurrentMatch, viewerId);
      } else {
        if (current) current.value = "";
        clearPreview();
      }
    }
  };

  // override browser search shortcut
  const handleShortcut = useCallback(
    (e: KeydownEvent) => {
      if (
        (e[CHORD_KEY] && e.key === "f") ||
        (e.key === "/" && !isActiveElementEditable())
      ) {
        e.preventDefault();
        current?.focus();
      }
    },
    [current],
  );
  useGlobalKeydownEvent(handleShortcut);

  return (
    <input
      ref={ref}
      type="input"
      aria-invalid={invalidRegex}
      title={invalidRegex ? t.toolbar.search.invalidRegex : undefined}
      className={classNames(
        "placeholder-input-foreground/50 focus:outline-hidden",
        className,
      )}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={t.toolbar.search.placeholder}
    />
  );
}
