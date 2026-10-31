import { isHexColor } from "../HexColorPreview";
import { Match } from "./Match";

export const SYNTAX_TYPE = "syntax";

export interface SyntaxMatch extends Match<{
  className: string;
  hexColor?: string;
}> {
  type: typeof SYNTAX_TYPE;
}

export function matchJsonSyntax(text: string): SyntaxMatch[] {
  // JSON strings cannot contain literal newlines. Consume escaped characters
  // together so escaped quotes never end a string token.
  const tokens =
    /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  const keySuffix = /\s*:/y;
  return Array.from(text.matchAll(tokens), (match) => {
    const start = match.index;
    const end = start + match[0].length;
    const isString = match[0].startsWith('"');
    let isKey = false;
    if (isString) {
      keySuffix.lastIndex = end;
      isKey = keySuffix.test(text);
    }
    const value = isString && !isKey ? match[0].slice(1, -1) : "";
    return {
      id: `syntax-${start}`,
      start,
      end,
      type: SYNTAX_TYPE,
      metadata: {
        hexColor: isHexColor(value) ? value : undefined,
        className: isKey
          ? "text-json-key"
          : isString
            ? "text-json-string"
            : "text-json-value",
      },
    };
  });
}
