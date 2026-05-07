---
description: 'Markdown formatting aligned to the CommonMark specification (0.31.2)'
applyTo: '**/*.md'
---

# CommonMark Markdown

Apply these rules per the [CommonMark spec 0.31.2](https://spec.commonmark.org/0.31.2/) when writing or reviewing `.md` files.

## Preliminaries

- Replace `U+0000` with the replacement character `U+FFFD`.
- **Backslash escapes**: `\` before any ASCII punctuation renders the literal character. Not active inside code spans, code blocks, or autolinks.
- **Entity references**: `&amp;`, `&#123;`, `&#x7B;` — valid HTML5 entities only. Cannot replace structural characters.

## Leaf Blocks

- **Thematic breaks**: 3+ matching `-`, `_`, or `*` on a line; 0–3 spaces indent; only spaces/tabs otherwise.
- **ATX headings**: 1–6 `#` followed by a space or end of line; 0–3 spaces indent.
- **Setext headings**: Text underlined with `=` (level 1) or `-` (level 2). Cannot interrupt a paragraph — requires preceding blank line.
- **Indented code blocks**: Lines indented 4+ spaces. Cannot interrupt a paragraph. Content is literal text.
- **Fenced code blocks**: Open with 3+ backticks or tildes (same character for close; count ≥ open count). Info string after backtick fence cannot contain backticks. Specify language identifier.
- **Link reference definitions**: `[label]: destination "title"`. Labels are case-insensitive; first definition wins.

## Container Blocks

- **Block quotes**: Lines prefixed with `>` (optionally + space). Lazy continuation allowed for paragraph text only. Blank line separates consecutive block quotes.
- **List items**: Bullet markers (`-`, `+`, `*`) or ordered markers (digits + `.` or `)`). Content column = marker width + spaces (1–4) to first non-whitespace. Sublists must be indented to the content column. An ordered list interrupting a paragraph must start at `1`.
- **Lists**: Same-type sequence. Changing bullet character or ordered delimiter starts a new list. A list is loose if any item is separated by a blank line.

## Inlines

- **Code spans**: Backtick-delimited. Line endings convert to spaces. Leading/trailing space stripped when both present. Backslash escapes are literal inside code spans.
- **Emphasis**: `*`/`_` for `<em>`, `**`/`__` for `<strong>`. `_` is NOT allowed for intraword emphasis. Delimiter run length sum must not be a multiple of 3 when a delimiter can both open and close (unless both lengths are multiples of 3).
- **Links**: `[text](url "title")` or reference `[text][label]`. No whitespace between link text and `(` or `[`. Destination in `<…>` allows spaces.
- **Images**: `![alt](src "title")`. Alt text must be non-empty.
- **Autolinks**: `<URI>` in angle brackets. Bare URLs are NOT autolinks in CommonMark.
- **Hard line breaks**: Two+ trailing spaces or `\` before a line ending. Not active in code spans or HTML tags.

## Validation Checklist

- [ ] ATX headings: 1–6 `#` followed by a space.
- [ ] Fenced code blocks: specify a language identifier; use matching fence characters and counts.
- [ ] Backtick fence info strings do not contain backtick characters.
- [ ] Indented code blocks are preceded by a blank line (cannot interrupt a paragraph).
- [ ] Emphasis: use `*` for intraword; `_` only at word boundaries.
- [ ] Links: no whitespace before `(` or `[`.
- [ ] Images: non-empty alt text.
- [ ] Autolinks: use angle brackets (`<URL>`); bare URLs are not CommonMark autolinks.
- [ ] No unbalanced parentheses in bare link destinations (use `<…>` or escape).
- [ ] HTML block type 7 is preceded by a blank line when following a paragraph.

For deep guidance, see [docs/agents/markdown-reference.md](../../docs/agents/markdown-reference.md).
