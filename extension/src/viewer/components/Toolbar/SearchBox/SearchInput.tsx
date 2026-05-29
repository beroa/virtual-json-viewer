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
  enableTreeEscape: boolean;
  isCommitted: boolean;
  isSearchCommitted: () => boolean;
  hasSelectedMatch: boolean;
  text: string;
  setText: (text: string) => void;
  clearPreview: () => void;
  commitSearch: () => void;
}>;

export function SearchInput({
  enableTreeEscape,
  isCommitted,
  isSearchCommitted,
  hasSelectedMatch,
  text,
  setText,
  clearPreview,
  commitSearch,
  className,
}: SearchInputProps): JSX.Element {
  const t = useContext(TranslationContext);
  const { searchDelay } = useContext(SettingsContext);

  const [current, ref] = useReactiveRef<HTMLInputElement>();

  // restore the input element internal state on rerender
  if (current) current.value = text;

  // debounce onChange event to wait until user stops typing
  const timeoutId = useRef<Nullable<NodeJS.Timeout>>(null);

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
    timeoutId.current = setTimeout(() => setText(text), searchDelay);
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
    if (e.key === "Enter") {
      e.preventDefault();
      const [nextText, textChanged] = flushText();
      if (!nextText) return;

      if (isCommitted && !textChanged) {
        dispatch(
          e.shiftKey
            ? ViewerEventType.SearchNavigatePrevious
            : ViewerEventType.SearchNavigateNext,
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
        dispatch(ViewerEventType.SearchFocusCurrentMatch);
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
