Detailed reference for [.github/instructions/markdown.instructions.md](../../.github/instructions/markdown.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# CommonMark Markdown — Deep Reference

## Specification

Full spec: [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/). Do not download the spec; use the link for reference only.

## Character and Line Handling

- A line ends at a newline (`U+000A`), carriage return (`U+000D`), or end of file.
- A blank line contains only spaces or tabs.
- Tabs behave as 4-space tab stops for block structure but are NOT expanded in content.
- `U+0000` is replaced with the replacement character `U+FFFD`.

## HTML Blocks (7 Types)

| Type | Starts with | Ends at |
|------|------------|---------|
| 1 | `<script`, `<pre`, `<style`, `<textarea` (case-insensitive) | Matching end tag |
| 2 | `<!--` | `-->` |
| 3 | `<?` | `?>` |
| 4 | `<!` + uppercase letter | `>` |
| 5 | `<![CDATA[` | `]]>` |
| 6 | Known block-level tag (e.g., `<div`, `<p`, `<table`) | Blank line |
| 7 | Any other open/close tag at block level | Blank line |

Type 6 and 7 end at the next blank line. **Type 7 cannot interrupt a paragraph** — must be preceded by a blank line.

## Block Quote Details

Lazy continuation: a continuation line of a block quote paragraph need not start with `>`. This is valid:

```markdown
> Start of block quote
continuation without >
```

A blank line separates consecutive block quotes — two consecutive `>` lines without a blank between them form ONE block quote.

## List Item Details

- Content column is determined by: marker width + number of spaces (1–4) to first non-whitespace character.
- If there are 5+ spaces after the marker, only 1 space is consumed; the rest are part of the content (may create an indented code block).
- Sublists must indent to the content column of the parent list item.
- An ordered list starting with a number other than `1` cannot interrupt a paragraph.
- A list is **loose** if any of its constituent items are separated by blank lines; a loose list wraps items in `<p>` tags.

## Emphasis Rules (Detailed)

The flanking delimiter rules:
- A left-flanking delimiter run: not followed by Unicode whitespace; and either not followed by a punctuation character, or preceded by Unicode whitespace or punctuation.
- A right-flanking delimiter run: not preceded by Unicode whitespace; and either not preceded by a punctuation character, or followed by Unicode whitespace or punctuation.

`_` rules are stricter: `_` can open emphasis only if it is left-flanking AND either not right-flanking OR preceded by punctuation. Symmetric rule for closing.

**Intraword:** `*` can create intraword emphasis; `_` cannot.

**Nested emphasis:** `***text***` produces `<em><strong>text</strong></em>`.

**Delimiter run sum rule:** When a delimiter can both open and close, the sum of lengths of the opening and closing delimiter runs must not be a multiple of 3, unless both lengths are individually multiples of 3.

## Link Syntax Details

**Inline link:** `[link text](destination "optional title")`
- Destination in `<…>` allows spaces and special characters.
- Without angle brackets: no spaces allowed; balanced parentheses are permitted.
- Title in `"…"`, `'…'`, or `(…)`.
- No whitespace between the closing `]` and the opening `(`.

**Reference link variants:**
- Full: `[text][label]`
- Collapsed: `[text][]` (label equals text)
- Shortcut: `[text]` (label equals text)
- No whitespace between `]` and `[`.

**Link reference definitions:** Must appear before the first use (or anywhere; order doesn't matter for resolution). First definition wins for duplicate labels. Labels are Unicode case-folded for matching.

**Links cannot be nested:** A link text cannot contain another link.

## Autolink Details

- Format: `<scheme:path>` where scheme is 2–32 ASCII letters.
- Email autolinks: `<user@domain.tld>` format.
- **Bare URLs are NOT autolinks in CommonMark.** Many renderers extend this, but the spec does not.

## Code Span Details

- Backtick strings of different lengths are independent: `` `code` `` and ` `` code `` ` are separate spans.
- A code span opener can be 1+ backticks; the closer must be the same count.
- Internal backticks that don't match the opener count are treated as literal characters.
- Leading and trailing single spaces are stripped only when the span is not entirely spaces.

## Hard vs Soft Line Breaks

- **Hard line break:** Two or more trailing spaces followed by a line ending, OR a `\` before a line ending. Renders as `<br>`.
- **Soft line break:** A line ending not qualified as a hard break. Renders as a space in HTML.
- Hard line breaks do NOT work at the end of a block element, in code spans, or in HTML tags.

## Setext Heading Constraints

- The underline `=` or `-` sequence must be on the immediately following line.
- A setext heading cannot interrupt a paragraph — there must be a blank line before the paragraph that precedes the heading text, OR the heading must be the first block.
- A setext heading of level 2 (`-`) requires 1+ `-` characters; `---` is valid but `- -` is a thematic break.

## Fenced Code Block Edge Cases

- Backtick fences: the info string (language identifier) cannot contain backtick characters. Tilde fences have no such restriction.
- The closing fence must use the same character as the opening fence and have at least as many characters.
- Indented fenced code blocks: up to 3 spaces of indentation are allowed on the opening fence; the same number is stripped from the content lines.
