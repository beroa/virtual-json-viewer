export type SearchMatchRange = {
  start: number;
  end: number;
};

export interface Searcher {
  findMatches(text: string): SearchMatchRange[];
}

export function buildSearcher(
  searchText: string,
  caseSensitive?: boolean,
  wholeWord?: boolean,
  regex?: boolean,
): Searcher {
  const searcher = regex
    ? new RegexSearcher(searchText, !!caseSensitive)
    : caseSensitive
      ? new CaseSensitiveSearcher(searchText)
      : new CaseInsensitiveSearcher(searchText);
  return wholeWord ? new WholeWordSearcher(searcher) : searcher;
}

export function isValidSearchRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, "u");
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
}

class RegexSearcher implements Searcher {
  private regex: RegExp | null;

  constructor(pattern: string, caseSensitive: boolean) {
    this.regex =
      pattern && isValidSearchRegex(pattern)
        ? new RegExp(pattern, caseSensitive ? "gu" : "giu")
        : null;
  }

  public findMatches(text: string): SearchMatchRange[] {
    if (!this.regex) return [];
    const matches: SearchMatchRange[] = [];
    this.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = this.regex.exec(text)) !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length });
      if (!match[0]) {
        const codePoint = text.codePointAt(this.regex.lastIndex);
        this.regex.lastIndex +=
          codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
      }
    }
    return matches;
  }
}

// VS Code's default editor.wordSeparators; underscores remain part of words.
const WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";

function isWordSeparator(char: string): boolean {
  return (
    char === "" || " \t\r\n".includes(char) || WORD_SEPARATORS.includes(char)
  );
}

class WholeWordSearcher implements Searcher {
  constructor(private searcher: Searcher) {}

  public findMatches(text: string): SearchMatchRange[] {
    return this.searcher.findMatches(text).filter(({ start, end }) => {
      const left =
        isWordSeparator(text[start - 1] ?? "") ||
        (end > start && isWordSeparator(text[start]));
      const right =
        isWordSeparator(text[end] ?? "") ||
        (end > start && isWordSeparator(text[end - 1]));
      return left && right;
    });
  }
}

class CaseInsensitiveSearcher implements Searcher {
  private search: Searcher;

  constructor(searchText: string) {
    this.search = new CaseSensitiveSearcher(searchText.toLowerCase());
  }

  public findMatches(text: string): SearchMatchRange[] {
    return this.search.findMatches(text.toLowerCase());
  }
}

class CaseSensitiveSearcher implements Searcher {
  private searchText: string;

  constructor(searchText: string) {
    this.searchText = searchText;
  }

  public findMatches(text: string): SearchMatchRange[] {
    const matches: SearchMatchRange[] = [];

    if (!this.searchText) return matches;

    let start = text.indexOf(this.searchText);
    while (start !== -1) {
      const end = start + this.searchText.length;
      matches.push({ start, end });
      start = text.indexOf(this.searchText, end);
    }

    return matches;
  }
}
