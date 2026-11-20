import assert from "node:assert/strict";
import test from "node:test";
import { buildSearcher } from "../src/viewer/commons/Searcher";

test("whole-word matching uses VS Code's default word boundaries", () => {
  const text = "cat catfish _cat cat_ (cat) cat-cat CAT écat caté";
  const searcher = buildSearcher("cat", false, true);
  assert.deepEqual(
    searcher.findMatches(text).map(({ start, end }) => text.slice(start, end)),
    ["cat", "cat", "cat", "cat", "CAT"],
  );
  assert.deepEqual(
    searcher.findMatches(text).map(({ start }) => start),
    [0, 23, 28, 32, 36],
  );
});

test("whole-word matching handles punctuation queries, case and empty input", () => {
  assert.deepEqual(
    buildSearcher(".foo", true, true).findMatches("x.foo! x.Foo!"),
    [{ start: 1, end: 5 }],
  );
  assert.deepEqual(buildSearcher("cat", true, true).findMatches("CAT cat"), [
    { start: 4, end: 7 },
  ]);
  assert.deepEqual(buildSearcher("", false, true).findMatches("text"), []);
});

test("regular expressions honor case and whole-word options", () => {
  const text = "cat CATS cats catfish dog";
  assert.deepEqual(
    buildSearcher("cats?", false, true, true).findMatches(text),
    [
      { start: 0, end: 3 },
      { start: 4, end: 8 },
      { start: 9, end: 13 },
    ],
  );
  assert.deepEqual(buildSearcher("cats?", true, true, true).findMatches(text), [
    { start: 0, end: 3 },
    { start: 9, end: 13 },
  ]);
  assert.deepEqual(
    buildSearcher("c.t", false, false, false).findMatches(text),
    [],
  );
});

test("invalid patterns return no matches and zero-width expressions advance across Unicode", () => {
  assert.deepEqual(
    buildSearcher("[", false, false, true).findMatches("text"),
    [],
  );
  assert.deepEqual(
    buildSearcher("(?=.)", false, false, true).findMatches("😀x"),
    [
      { start: 0, end: 0 },
      { start: 2, end: 2 },
    ],
  );
  assert.deepEqual(buildSearcher("$", false, false, true).findMatches("x"), [
    { start: 1, end: 1 },
  ]);
});

test("zero-width matches remain navigable when rendered with other highlights", async () => {
  const { renderMatches } =
    await import("../src/viewer/components/RenderedText/Renderer");
  const { matchSearch } =
    await import("../src/viewer/components/RenderedText/SearchedText");
  const searchMatches = matchSearch("😀x", "(?=.)", false, false, true);
  const rendered = renderMatches("😀x", {
    diffMatches: [],
    linkMatches: [],
    searchMatches,
    syntaxMatches: [
      {
        id: "syntax",
        type: "syntax",
        start: 0,
        end: 3,
        metadata: { className: "test" },
      },
    ],
  });
  assert.equal(rendered.searchMatches.length, 2);
});
