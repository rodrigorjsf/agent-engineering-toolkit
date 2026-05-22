# Wiki-first knowledge base (Karpathy methodology) replaces RAG MCP server

The repository's documentation lookup is reorienting from a custom RAG MCP server (`rag-knowledge-base`, sqlite-vec backed embeddings under the deleted `rag/` package) to a curated `wiki/knowledge/` directory inspired by Andrej Karpathy's "LLM Knowledge Bases" pattern. At our scale (~38 wiki pages), explicit `index.md`-driven file reads outperform vector retrieval on coherence, citability, and maintenance cost — and remove the MCP/Python toolchain entirely. The RAG infrastructure (`rag/` package, `.mcp.json` server registration, `check-rag-reindex.sh` hook, three `rag-*` rule files) is deleted; agents now read `wiki/knowledge/index.md` first, follow `[[wiki-link]]`s into specific pages, and only fall through to `docs/` when the wiki lacks coverage.

## Karpathy methodology (reference)

Source: Andrej Karpathy, "LLM Knowledge Bases" (X / Twitter post, 2026). Pattern summary:

- **Data ingest** — raw source documents (papers, articles, repos, datasets, images) live in an immutable `raw/` directory. An LLM incrementally compiles a `wiki/` of `.md` pages: per-source summaries, concept articles, backlinks, and a maintained `index.md`.
- **IDE** — Obsidian as the frontend; the LLM (not the human) writes and maintains the wiki.
- **Q&A** — the LLM reads `index.md` first, then specific pages. At ~100 articles / 400K words Karpathy reports vector RAG was unnecessary because the LLM auto-maintains compact index files and reads the related data directly.
- **Output** — answers are rendered as markdown / Marp slides / matplotlib images and **filed back** into the wiki to compound knowledge over time.
- **Linting** — periodic LLM "health checks" find contradictions, orphan pages, missing backlinks, and stale claims.
- **Extra tools** — a small vibe-coded search CLI over the wiki, handed to the LLM as a tool for larger queries.
- **Further explorations** — synthetic data generation + fine-tuning so the LLM "knows" the wiki in weights, not just context windows.

## How this repository adapts the methodology

- `docs/` plays the role of `raw/`. We do **not** rename — too many cross-references in rules, skills, and CI — but the immutability invariant carries over. **(Amended by [ADR-0010](0010-vendor-doc-mirrors-are-living.md): vendor-documentation mirrors — `docs/claude/`, `docs/claude-code/`, `docs/cursor/` — are living, re-syncable mirrors; immutability holds for all other `docs/` artifacts.)**
- `wiki/knowledge/` is the compiled wiki. `index.md` and `log.md` are agent-maintained.
- A new `.claude/rules/wiki-routing.md` enforces the lookup order: `wiki/knowledge/index.md` → specific page → `docs/` fallback.
- A new `wiki-ingest` skill (slash command `/wiki-ingest`) mechanizes Karpathy's "data ingest" loop when a new file is added under `docs/`.
- A new `wiki-lint` skill (slash command `/wiki-lint`) mechanizes the "health check" loop (orphans, contradictions, missing backlinks, stale claims).
- Obsidian (`wiki/.obsidian/`) is the human IDE; the LLM is the writer.

## Deferred (future work)

Karpathy describes extensions this repository explicitly **does not yet build**, but reserves space for:

1. **Search CLI engine over the wiki.** A small vibe-coded search tool exposed both to humans (web/CLI UI) and to LLM agents as a tool. Becomes valuable once `index.md` browsing loses specificity at scale. Strong candidate for a future skill (e.g., `wiki:search`) backed by a local CLI under `tools/` or a Rust/Go binary. **Re-evaluate trigger:** wiki page count > 100, OR index-driven lookup misses become a recurring pain in real sessions.

2. **Synthetic data + fine-tuning.** Generate Q&A pairs from the wiki and fine-tune a small model so domain knowledge lives in weights, not context. Out of scope for the current toolkit (we ship plugins, not models), but a defensible path if this repository ever produces a turnkey "agent-engineering assistant" model.

3. **Multi-modal output rendering.** Karpathy mentions Marp slide rendering and matplotlib image generation as alternative output formats filed back into the wiki. Out of scope today; revisit if/when output artifacts beyond markdown become a recurring need.

## Why now

The previous RAG-first posture optimized for retrieval at unbounded scale, but the wiki has stayed compact (~38 pages) and the validation/quality-gate skills already cite specific page slugs rather than performing semantic queries. The infrastructure cost (sqlite-vec, embedding pipeline, reindex hook, MCP server) no longer pays for itself.
