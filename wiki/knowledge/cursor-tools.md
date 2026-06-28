# Cursor Tools

**Summary**: Built-in tool capabilities in Cursor IDE — browser automation with visual testing, semantic and grep code search, sandboxed terminal execution with enterprise controls, and git worktrees for parallel agent execution and multi-model comparison.
**Sources**: browser-guide.md, search-guide.md, terminal-guide.md, worktrees-guide.md
**Last updated**: 2026-05-22

---

## Browser Tool

Native browser integration for web automation and visual testing:

| Capability | Description                             |
| ---------- | --------------------------------------- |
| Navigate   | URLs, links, back/forward, refresh      |
| Click      | Click, double-click, right-click, hover |
| Type       | Forms, input fields                     |
| Scroll     | Navigate long pages                     |
| Screenshot | Capture visual state                    |
| Console    | Read logs, errors, warnings             |
| Network    | Monitor HTTP requests/responses         |

**Design Sidebar** enables real-time visual editing: position, dimensions, colors, theme testing.

**Session persistence**: Cookies, localStorage, sessionStorage, IndexedDB preserved across sessions with per-workspace isolation.

Recommended models: Sonnet 4.5, GPT-5, Auto.

## Search Tool

Two search mechanisms:

| Type                | Engine            | Best For                                            |
| ------------------- | ----------------- | --------------------------------------------------- |
| **Instant Grep**    | Ripgrep           | Exact matches (functions, variables, errors, regex) |
| **Semantic Search** | Vector embeddings | Conceptual queries ("where do we handle auth?")     |

**Indexing**: Automatic on workspace open; 80% complete before available; syncs every 5 minutes on changed files only. Respects `.gitignore` and `.cursorignore`.

**Privacy**: File paths encrypted before sending; code never stored in plaintext; embeddings created without source code; deleted after 6 weeks of inactivity.

## Terminal Tool

Sandboxed shell execution that blocks unauthorized file access and network activity, keeping commands confined to the workspace (source: terminal-guide.md):

| Platform | Sandbox                                                                 |
| -------- | ----------------------------------------------------------------------- |
| macOS    | Built-in (Cursor v2.0+); works out of the box                           |
| Windows  | Runs inside WSL2, applying the same restrictions as Linux               |
| Linux    | Kernel 6.2+ with **Landlock v3** support + unprivileged user namespaces |

If a Linux kernel doesn't meet the requirements, Agent falls back to asking for approval. The `.cursor` configuration directory stays protected regardless of allowlist settings.

**AppArmor setup**: The Cursor desktop package ships the required AppArmor profile. Remote environments and the standalone CLI do not — install the `cursor-sandbox-apparmor` package (version `0.6.0`) for your distribution if sandbox creation fails with a user-namespace permissions error (source: terminal-guide.md).

**Auto-run modes** (Settings → Cursor Settings → Agents → Auto-Run):

| Mode                         | Behavior                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Allowlist**                | Only allowlisted tools/commands auto-run; everything else needs approval        |
| **Allowlist (with Sandbox)** | Allowlisted items auto-run outside the sandbox; all others auto-run sandboxed    |
| **Run Everything**           | All tools and commands run automatically without asking                         |

Before Cursor 3.5 these were named **Run in Sandbox**, **Ask Every Time**, and **Run Everything**. **Run in Sandbox** maps to **Allowlist (with Sandbox)**; **Ask Every Time** is deprecated — use **Allowlist** with empty allowlists to require approval for everything (source: terminal-guide.md).

**Protection settings**: Command allowlist, MCP allowlist, browser protection, file-deletion protection, dotfile protection, external-file protection. Enterprise admins can override these and control auto-run, sandboxing mode, sandbox networking, and whether **Run Everything** is available.

## Worktrees Tool

Git-based isolation so Agent works in separate checkouts while the main checkout stays untouched — used to run several agents on the same repo without conflicts (source: worktrees-guide.md).

The UI-native worktrees feature lives in the **Agents Window**: starting or moving an agent into a worktree creates a separate checkout, and after the agent finishes you review the result and can keep working, create a commit or PR from that checkout, or bring the result back into the main workspace.

In the **Editor Window**, use the Worktree Skills commands instead:

| Command                      | Purpose                        |
| ---------------------------- | ------------------------------ |
| `/worktree <task>`           | Isolated experimental run      |
| `/best-of-n <models> <task>` | Multi-model comparison         |
| `/apply-worktree`            | Bring changes to main checkout |
| `/delete-worktree`           | Remove worktree                |

**Setup**: `.cursor/worktrees.json` with `setup-worktree`, `setup-worktree-unix`, and `setup-worktree-windows` keys, each accepting an array of shell commands or a script filepath.

**Cleanup** (Cursor 3.5+): runs on an interval and keeps the newest worktrees up to a machine-wide cap. Configured via machine-scoped settings — `cursor.worktreeCleanupIntervalHours` and `cursor.worktreeMaxCount` (default cap **25** worktrees per machine, shared across all workspaces) (source: worktrees-guide.md).

**Key practice**: Don't symlink dependencies into the worktree (it breaks the main worktree) — use a fast package manager (`bun`, `pnpm`, `uv`) and copy `.env` files instead.

## Related pages

- [[cursor-mcp]]
- [[cursor-plugins]]
- [[cursor-subagents]]
- [[agent-workflows]]
- [[claude-code-worktrees]]
