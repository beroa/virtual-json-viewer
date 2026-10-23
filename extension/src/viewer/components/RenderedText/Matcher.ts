import { DiffMatch } from "./DiffText";
import { SearchMatch } from "./SearchedText";
export type { DiffMatch } from "./DiffText";
export { matchLinks } from "./LinkifiedText";
export type { LinkMatch } from "./LinkifiedText";
export { matchSearch, searchMatchFromSearcher } from "./SearchedText";
export type { SearchMatch } from "./SearchedText";

import { SyntaxMatch } from "./JsonSyntax";
import { LinkMatch } from "./LinkifiedText";

export type MatchesResult = {
  diffMatches: DiffMatch[];
  searchMatches: SearchMatch[];
  linkMatches: LinkMatch[];
  syntaxMatches?: SyntaxMatch[];
};
