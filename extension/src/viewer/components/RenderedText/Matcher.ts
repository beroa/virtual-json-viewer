import { SearchMatch } from "./SearchedText";
export { matchLinks } from "./LinkifiedText";
export type { LinkMatch } from "./LinkifiedText";
export { matchSearch, searchMatchFromSearcher } from "./SearchedText";
export type { SearchMatch } from "./SearchedText";

import { SyntaxMatch } from "./JsonSyntax";
import { LinkMatch } from "./LinkifiedText";

export type MatchesResult = {
  searchMatches: SearchMatch[];
  linkMatches: LinkMatch[];
  syntaxMatches?: SyntaxMatch[];
};
