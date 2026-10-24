import { diffArrays, diffWordsWithSpace } from "diff";
import * as Json from "./Json";

export enum DiffKind {
  Same = "same",
  Added = "added",
  Removed = "removed",
  Changed = "changed",
  TypeChanged = "type-changed",
}

export type DiffByPath = Record<string, DiffKind>;

export type DiffResult = {
  left: DiffByPath;
  right: DiffByPath;
  hasDiff: boolean;
};

export type InlineDiff = {
  start: number;
  end: number;
  kind: DiffKind;
};

export type RawDiffLine = {
  text: string;
  lineNumber: Nullable<number>;
  kind: DiffKind;
  placeholder?: boolean;
  inlineDiffs?: InlineDiff[];
};

export type RawDiffResult = {
  left: RawDiffLine[];
  right: RawDiffLine[];
};

type MaybeRoot = Json.Root | undefined | null;

const ARRAY_MATCH_KEYS = [
  "id",
  "canonical_url",
  "url",
  "slug",
  "title",
  "name",
];
const LCS_MATRIX_LIMIT = 120_000;

export function compareJsonLines(
  leftLines: Json.Lines,
  rightLines: Json.Lines,
  ignorePattern?: RegExp,
): DiffResult {
  const result: DiffResult = {
    left: {},
    right: {},
    hasDiff: false,
  };

  result.hasDiff = compareAtPaths(
    asRoot(leftLines),
    asRoot(rightLines),
    ".",
    ".",
    result,
    ignorePattern,
  );

  result.hasDiff =
    Object.keys(result.left).length > 0 || Object.keys(result.right).length > 0;
  return result;
}

export function compareRawLines(
  leftLines: string[],
  rightLines: string[],
): RawDiffResult {
  const left = leftLines.map((text, index) => ({
    text,
    lineNumber: index + 1,
  }));
  const right = rightLines.map((text, index) => ({
    text,
    lineNumber: index + 1,
  }));

  return buildJsDiffRawDiff(left, right);
}

function compareAtPaths(
  left: MaybeRoot,
  right: MaybeRoot,
  leftPath: string,
  rightPath: string,
  result: DiffResult,
  ignorePattern?: RegExp,
  nodeKey?: string,
): boolean {
  const ignored =
    matchesNodeLine(left, nodeKey, ignorePattern) ||
    matchesNodeLine(right, nodeKey, ignorePattern);
  if (left === undefined) {
    markSubtree(
      right!,
      rightPath,
      result.right,
      DiffKind.Added,
      ignorePattern,
      nodeKey,
    );
    return true;
  }

  if (right === undefined) {
    markSubtree(
      left,
      leftPath,
      result.left,
      DiffKind.Removed,
      ignorePattern,
      nodeKey,
    );
    return true;
  }

  if (!sameNodeType(left, right)) {
    if (ignored) return false;
    markPath(result.left, leftPath, DiffKind.TypeChanged);
    markPath(result.right, rightPath, DiffKind.TypeChanged);
    return true;
  }

  if (Json.isLiteral(left) && Json.isLiteral(right)) {
    if (ignored || Object.is(left, right)) {
      return false;
    }

    markPath(result.left, leftPath, DiffKind.Changed);
    markPath(result.right, rightPath, DiffKind.Changed);
    return true;
  }

  let hasDiff = false;

  if (Json.isArray(left) && Json.isArray(right)) {
    for (const pair of alignArrayValues(left, right)) {
      hasDiff =
        compareAtPaths(
          pair.leftIndex === undefined ? undefined : left[pair.leftIndex],
          pair.rightIndex === undefined ? undefined : right[pair.rightIndex],
          pair.leftIndex === undefined
            ? leftPath
            : childPath(leftPath, pair.leftIndex),
          pair.rightIndex === undefined
            ? rightPath
            : childPath(rightPath, pair.rightIndex),
          result,
          ignorePattern,
        ) || hasDiff;
    }

    return hasDiff;
  }

  if (Json.isObject(left) && Json.isObject(right)) {
    const keys = unionKeys(left.keys, right.keys);
    for (const key of keys) {
      hasDiff =
        compareAtPaths(
          left.content[key],
          right.content[key],
          childPath(leftPath, key),
          childPath(rightPath, key),
          result,
          ignorePattern,
          key,
        ) || hasDiff;
    }
  }

  return hasDiff;
}

function buildJsDiffRawDiff(
  left: Array<{ text: string; lineNumber: number }>,
  right: Array<{ text: string; lineNumber: number }>,
): RawDiffResult {
  const leftLines: RawDiffLine[] = [];
  const rightLines: RawDiffLine[] = [];
  const changes = diffArrays(left, right, {
    comparator: (leftLine, rightLine) => leftLine.text === rightLine.text,
  });

  for (let index = 0; index < changes.length; index++) {
    const change = changes[index];
    const nextChange = changes[index + 1];

    if (change.removed && nextChange?.added) {
      appendChangedBlock(change.value, nextChange.value, leftLines, rightLines);
      index++;
      continue;
    }

    if (change.added && nextChange?.removed) {
      appendChangedBlock(nextChange.value, change.value, leftLines, rightLines);
      index++;
      continue;
    }

    if (change.removed) {
      change.value.forEach((line) =>
        appendRemovedLine(line, leftLines, rightLines),
      );
      continue;
    }

    if (change.added) {
      change.value.forEach((line) =>
        appendAddedLine(line, leftLines, rightLines),
      );
      continue;
    }

    change.value.forEach((line) => {
      leftLines.push({
        text: line.text,
        lineNumber: line.lineNumber,
        kind: DiffKind.Same,
      });
      rightLines.push({
        text: line.text,
        lineNumber: line.lineNumber,
        kind: DiffKind.Same,
      });
    });
  }

  return {
    left: leftLines,
    right: rightLines,
  };
}

function appendChangedBlock(
  leftSegment: Array<{ text: string; lineNumber: number }>,
  rightSegment: Array<{ text: string; lineNumber: number }>,
  leftLines: RawDiffLine[],
  rightLines: RawDiffLine[],
) {
  const pairCount = Math.min(leftSegment.length, rightSegment.length);

  for (let index = 0; index < pairCount; index++) {
    const leftLine = leftSegment[index];
    const rightLine = rightSegment[index];
    const inlineDiff = buildInlineDiffs(leftLine.text, rightLine.text);

    leftLines.push({
      text: leftLine.text,
      lineNumber: leftLine.lineNumber,
      kind: DiffKind.Removed,
      inlineDiffs: inlineDiff.left,
    });
    rightLines.push({
      text: rightLine.text,
      lineNumber: rightLine.lineNumber,
      kind: DiffKind.Added,
      inlineDiffs: inlineDiff.right,
    });
  }

  leftSegment
    .slice(pairCount)
    .forEach((line) => appendRemovedLine(line, leftLines, rightLines));
  rightSegment
    .slice(pairCount)
    .forEach((line) => appendAddedLine(line, leftLines, rightLines));
}

function appendRemovedLine(
  line: { text: string; lineNumber: number },
  leftLines: RawDiffLine[],
  rightLines: RawDiffLine[],
) {
  leftLines.push({
    text: line.text,
    lineNumber: line.lineNumber,
    kind: DiffKind.Removed,
    inlineDiffs: fullLineDiff(line.text, DiffKind.Removed),
  });
  rightLines.push({
    text: "",
    lineNumber: null,
    kind: DiffKind.Removed,
    placeholder: true,
  });
}

function appendAddedLine(
  line: { text: string; lineNumber: number },
  leftLines: RawDiffLine[],
  rightLines: RawDiffLine[],
) {
  leftLines.push({
    text: "",
    lineNumber: null,
    kind: DiffKind.Added,
    placeholder: true,
  });
  rightLines.push({
    text: line.text,
    lineNumber: line.lineNumber,
    kind: DiffKind.Added,
    inlineDiffs: fullLineDiff(line.text, DiffKind.Added),
  });
}

function fullLineDiff(text: string, kind: DiffKind): InlineDiff[] {
  return text ? [{ start: 0, end: text.length, kind }] : [];
}

function buildInlineDiffs(
  leftText: string,
  rightText: string,
): { left: InlineDiff[]; right: InlineDiff[] } {
  const leftDiffs: InlineDiff[] = [];
  const rightDiffs: InlineDiff[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  diffWordsWithSpace(leftText, rightText).forEach((part) => {
    const length = part.value.length;

    if (part.removed) {
      leftDiffs.push({
        start: leftIndex,
        end: leftIndex + length,
        kind: DiffKind.Removed,
      });
      leftIndex += length;
      return;
    }

    if (part.added) {
      rightDiffs.push({
        start: rightIndex,
        end: rightIndex + length,
        kind: DiffKind.Added,
      });
      rightIndex += length;
      return;
    }

    leftIndex += length;
    rightIndex += length;
  });

  return {
    left: leftDiffs,
    right: rightDiffs,
  };
}

function alignArrayValues(
  left: Json.Array,
  right: Json.Array,
): Array<{ leftIndex?: number; rightIndex?: number }> {
  const leftTokens = left.map(arrayAlignmentToken);
  const rightTokens = right.map(arrayAlignmentToken);
  const anchors = findAnchors(
    leftTokens,
    rightTokens,
    (a, b) => a !== null && b !== null && a === b,
    left.length * right.length,
  );

  const result: Array<{ leftIndex?: number; rightIndex?: number }> = [];
  let leftCursor = 0;
  let rightCursor = 0;

  for (const [leftAnchor, rightAnchor] of anchors) {
    pairArraySegment(leftCursor, leftAnchor, rightCursor, rightAnchor, result);
    result.push({ leftIndex: leftAnchor, rightIndex: rightAnchor });
    leftCursor = leftAnchor + 1;
    rightCursor = rightAnchor + 1;
  }

  pairArraySegment(leftCursor, left.length, rightCursor, right.length, result);
  return result;
}

function pairArraySegment(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  target: Array<{ leftIndex?: number; rightIndex?: number }>,
) {
  while (leftStart < leftEnd && rightStart < rightEnd) {
    target.push({ leftIndex: leftStart++, rightIndex: rightStart++ });
  }

  while (leftStart < leftEnd) {
    target.push({ leftIndex: leftStart++ });
  }

  while (rightStart < rightEnd) {
    target.push({ rightIndex: rightStart++ });
  }
}

function arrayAlignmentToken(value: Json.Root): string | null {
  if (Json.isLiteral(value)) {
    return `literal:${JSON.stringify(value)}`;
  }

  if (Json.isObject(value)) {
    for (const key of ARRAY_MATCH_KEYS) {
      const candidate = value.content[key];
      if (Json.isLiteral(candidate) && candidate !== null) {
        return `${key}:${String(candidate)}`;
      }
    }
  }

  if (Json.isLeaf(value)) {
    return Json.toString(value, { sortKeys: true });
  }

  return null;
}

function findAnchors<T>(
  left: T[],
  right: T[],
  equals: (left: T, right: T) => boolean,
  complexity: number,
): Array<[number, number]> {
  if (!left.length || !right.length || complexity > LCS_MATRIX_LIMIT) {
    return [];
  }

  const dp = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex--) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex--) {
      dp[leftIndex][rightIndex] = equals(left[leftIndex], right[rightIndex])
        ? dp[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(
            dp[leftIndex + 1][rightIndex],
            dp[leftIndex][rightIndex + 1],
          );
    }
  }

  const anchors: Array<[number, number]> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (equals(left[leftIndex], right[rightIndex])) {
      anchors.push([leftIndex, rightIndex]);
      leftIndex++;
      rightIndex++;
      continue;
    }

    if (dp[leftIndex + 1][rightIndex] >= dp[leftIndex][rightIndex + 1]) {
      leftIndex++;
    } else {
      rightIndex++;
    }
  }

  return anchors;
}

function asRoot(lines: Json.Lines): Json.Root {
  return lines.length === 1 ? lines[0] : lines;
}

function markSubtree(
  root: Json.Root,
  path: string,
  target: DiffByPath,
  kind: DiffKind.Added | DiffKind.Removed,
  ignorePattern?: RegExp,
  nodeKey?: string,
) {
  if (!matchesNodeLine(root, nodeKey, ignorePattern))
    markPath(target, path, kind);

  if (Json.isArray(root)) {
    root.forEach((value, index) =>
      markSubtree(value, childPath(path, index), target, kind, ignorePattern),
    );
    return;
  }

  if (Json.isObject(root)) {
    root.keys.forEach((key) =>
      markSubtree(
        root.content[key],
        childPath(path, key),
        target,
        kind,
        ignorePattern,
        key,
      ),
    );
  }
}

function markPath(target: DiffByPath, path: string, kind: DiffKind) {
  target[path] = kind;
}

function unionKeys(leftKeys: string[], rightKeys: string[]): string[] {
  const result: string[] = [];
  const added = new Set<string>();

  for (const key of leftKeys) {
    if (!added.has(key)) {
      result.push(key);
      added.add(key);
    }
  }

  for (const key of rightKeys) {
    if (!added.has(key)) {
      result.push(key);
      added.add(key);
    }
  }

  return result;
}

function childPath(path: string, key: Json.Key): string {
  return path === "." ? `.${key}` : `${path}.${key}`;
}

function sameNodeType(left: Json.Root, right: Json.Root): boolean {
  if (Json.isArray(left) || Json.isArray(right)) {
    return Json.isArray(left) && Json.isArray(right);
  }

  if (Json.isObject(left) || Json.isObject(right)) {
    return Json.isObject(left) && Json.isObject(right);
  }

  return typeof left === typeof right || (left === null && right === null);
}

// Match only this tree row, not text belonging to its descendants.
function matchesNodeLine(
  root: MaybeRoot,
  nodeKey: string | undefined,
  pattern?: RegExp,
): boolean {
  if (root === undefined || !pattern) return false;
  const key = nodeKey === undefined ? "" : `${JSON.stringify(nodeKey)}: `;
  const value = Json.isLeaf(root)
    ? Json.toString(root)
    : Json.isArray(root)
      ? "["
      : "{";
  pattern.lastIndex = 0;
  return pattern.test(key + value);
}

export function ignoreRawDiffLines(
  result: RawDiffResult,
  pattern: RegExp,
): RawDiffResult {
  const left = [...result.left];
  const right = [...result.right];
  left.forEach((line, index) => {
    const matches = (candidate: RawDiffLine) => {
      pattern.lastIndex = 0;
      return !candidate.placeholder && pattern.test(candidate.text);
    };
    if (matches(line) || matches(right[index])) {
      left[index] = { ...line, kind: DiffKind.Same, inlineDiffs: [] };
      right[index] = { ...right[index], kind: DiffKind.Same, inlineDiffs: [] };
    }
  });
  return { left, right };
}
