import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareJsonLines,
  compareRawLines,
  DiffKind,
  ignoreRawDiffLines,
} from "../src/viewer/commons/Diff";
import * as Json from "../src/viewer/commons/Json";

function parse(text: string): Json.Lines {
  const result = Json.tryParseLines(text);
  if (result instanceof Error) throw result;
  return result;
}

test("matching either side suppresses both highlights without changing source text", () => {
  const original = compareRawLines(
    ['"time": "old"', '"value": 1'],
    ['"time": "new"', '"value": 2'],
  );
  const filtered = ignoreRawDiffLines(original, /old/);
  assert.equal(filtered.left[0].kind, DiffKind.Same);
  assert.equal(filtered.right[0].kind, DiffKind.Same);
  assert.deepEqual(filtered.right[0].inlineDiffs, []);
  assert.equal(filtered.right[0].text, '"time": "new"');
  assert.equal(filtered.left[1].kind, DiffKind.Removed);
  assert.equal(original.left[0].kind, DiffKind.Removed);
});

test("added and removed lines can be ignored, including repeated global matches", () => {
  for (const result of [
    compareRawLines([], ["a", "a"]),
    compareRawLines(["a", "a"], []),
  ]) {
    const filtered = ignoreRawDiffLines(result, /a/g);
    assert.ok(
      [...filtered.left, ...filtered.right].every(
        (line) => line.kind === DiffKind.Same,
      ),
    );
  }
});

test("tree ignores matching values and dotted keys while retaining unrelated changes", () => {
  const left = parse('{"updated.at": 1, "value": 1}');
  const right = parse('{"updated.at": 2, "value": 2}');
  const filtered = compareJsonLines(left, right, /"updated\.at":/);
  assert.deepEqual(filtered.left, { ".value": DiffKind.Changed });
  assert.equal(filtered.hasDiff, true);
  assert.equal(compareJsonLines(left, right, /./).hasDiff, false);
});

test("matching a collection opening does not ignore its changed children", () => {
  const filtered = compareJsonLines(
    parse('{"group": {"value": 1}}'),
    parse('{"group": {"value": 2}}'),
    /group/,
  );
  assert.equal(filtered.left[".group.value"], DiffKind.Changed);
});

test("ignored additions and removals do not leave a tree diff", () => {
  for (const [left, right] of [
    ["{}", '{"time": 1}'],
    ['{"time": 1}', "{}"],
  ]) {
    assert.equal(
      compareJsonLines(parse(left), parse(right), /time/).hasDiff,
      false,
    );
  }
});
