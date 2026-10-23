import { DiffMatch } from "./DiffText";
import { SearchMatch } from "./SearchedText";
export { matchLinks } from "./LinkifiedText";
export type { LinkMatch } from "./LinkifiedText";
export type { DiffMatch } from "./DiffText";
export { matchSearch, searchMatchFromSearcher } from "./SearchedText";
export type { SearchMatch } from "./SearchedText";

import { LinkMatch } from "./LinkifiedText";

export type MatchesResult = {
  diffMatches: DiffMatch[];
  searchMatches: SearchMatch[];
  linkMatches: LinkMatch[];
};
