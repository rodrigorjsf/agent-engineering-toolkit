# Set up Claude Code in a monorepo or large codebase
**Summary**: Scoping Claude Code to the part of a monorepo or large single-tree repo a task touches: start-directory semantics, worktree.sparsePaths/symlinkDirectories, additionalDirectories/--add-dir, Read deny rules, claudeMdExcludes, per-directory layering.
**Sources**: monorepos-and-large-repos.md
**Last updated**: 2026-06-04
---

A large codebase can be one repository with millions of lines or a monorepo with many packages. Claude Code works at any size, but as the codebase grows, defaults tuned for smaller projects can fill the context window with instructions and file reads unrelated to the task, costing tokens and degrading performance (source: monorepos-and-large-repos.md). The goal of every setting on this page is to scope Claude to the part of the tree a task actually touches. The same patterns apply to a monorepo (substitute `packages/api/`) or a large single tree (substitute a subsystem such as `src/backend/`) (source: monorepos-and-large-repos.md).

Each setting is independent and they **layer rather than replace** each other, so apply whichever fit your repository (source: monorepos-and-large-repos.md). These ideas are applications of [[context-engineering]] and [[progressive-disclosure]]: keep only what the task needs in context, and load the rest on demand.

## Choose where to start Claude

Where you launch `claude` is the most consequential decision, because it determines which files Claude can read and edit without an extra grant, which CLAUDE.md files load at startup, and which project settings apply (source: monorepos-and-large-repos.md). Read this section first — it decides where your other settings files live.

- **Start from the repository root**: Claude has file access to every file; only the root CLAUDE.md loads at launch, and each subdirectory's CLAUDE.md loads on demand when Claude reads a file there. Use this when tasks span multiple packages or subsystems (source: monorepos-and-large-repos.md).
- **Start from a subdirectory**: file access is scoped to that subtree only until you grant more, and Claude loads **that directory's CLAUDE.md plus every ancestor's at launch**. Use this when work is scoped to one package or subsystem (source: monorepos-and-large-repos.md).

The subdirectory case is the subtle one. Starting Claude *from* a subdirectory loads that directory's CLAUDE.md and every ancestor's at launch — the "subdirectory files load only on demand" rule holds only when you start from the root or an ancestor of that subdirectory (source: monorepos-and-large-repos.md). See [[claude-code-memory]] for how CLAUDE.md files load and interact in general.

Project settings in `.claude/settings.json` load **only from your starting directory** and are not inherited from parent directories the way CLAUDE.md files are: a root `.claude/settings.json` applies only when you start from the root (source: monorepos-and-large-repos.md). Each subdirectory's settings file must therefore be self-contained rather than layered on a root file (source: monorepos-and-large-repos.md).

## Layer CLAUDE.md files by directory

A single root CLAUDE.md tends either to grow to cover every subsystem (costing context on unrelated instructions) or to stay too generic to be useful; splitting instructions across per-directory files means Claude loads repository-wide rules plus only the conventions for the code you are working in (source: monorepos-and-large-repos.md). A common split is two levels: a **root** `CLAUDE.md` for rules that apply everywhere (coding standards, commit conventions, repository layout) and a **per-subdirectory** `CLAUDE.md` for conventions specific to that area's stack — one per package in a monorepo, one per subsystem such as `src/db/` in a single tree (source: monorepos-and-large-repos.md). Commit these files so teammates inherit them; each directory's owner typically maintains its file (source: monorepos-and-large-repos.md).

Keep the files current by reviewing CLAUDE.md edits in pull requests like any documentation change, by revisiting after major model releases (a rule that worked around an older model's limitation can become overhead once a newer model handles the case), and optionally by adding a `Stop` hook that proposes updates from the session transcript (source: monorepos-and-large-repos.md). See [[claude-code-hooks]] for the `Stop` hook, which receives the session-transcript path so a script can review the session and propose CLAUDE.md updates while the exposed gap is fresh (source: monorepos-and-large-repos.md).

### Per-directory CLAUDE.md vs path-scoped rules

Per-directory `CLAUDE.md` files and path-scoped rules under `.claude/rules/` both target instructions to part of the tree, but differ in where the file lives and when it loads (source: monorepos-and-large-repos.md). See [[agent-configuration-files]] for the broader file taxonomy.

- **Per-directory `CLAUDE.md`** lives inside the directory alongside its code, loads at launch when started from that directory (or on demand when Claude reads a file there), and suits directory owners maintaining their own conventions versioned with the code (source: monorepos-and-large-repos.md).
- **Path-scoped rule in `.claude/rules/`** lives in the central `.claude/` at the repo root and loads when Claude works with a file matching the rule's `paths:` glob; use it when you want all conventions in one place or the same rule applies to many scattered paths (source: monorepos-and-large-repos.md).

### Exclude irrelevant CLAUDE.md files

When you start from the repository root, each subdirectory's CLAUDE.md loads as soon as Claude reads a file there; the `claudeMdExcludes` setting skips specific files by path or glob so they never load (source: monorepos-and-large-repos.md). Use it for directories you never work in, such as other teams' packages, legacy code, or vendored subtrees. The exclusion list is **static, not a per-task switch** — to focus on a different package tomorrow, start Claude from that package's directory instead of editing exclusions (source: monorepos-and-large-repos.md).

Patterns use glob syntax matched against **absolute file paths**, so start relative-style patterns with `**/` to match anywhere in the tree (source: monorepos-and-large-repos.md). Excluding a package skips every CLAUDE.md and rules file under it while the root CLAUDE.md and the packages you do work in still load normally (source: monorepos-and-large-repos.md). Managed-policy CLAUDE.md files **cannot** be excluded, so organization-wide instructions always apply, and `claudeMdExcludes` can be set at any settings scope (user, project, local, managed) with arrays merging across scopes (source: monorepos-and-large-repos.md). Put the setting in the gitignored `.claude/settings.local.json` if you only want the exclusions for yourself (source: monorepos-and-large-repos.md). See [[claude-code-memory]] for the full exclusion semantics.

## Reduce what Claude reads

Instructions are only part of context; file reads grow with the codebase too. Claude's content searches respect `.gitignore` by default, so paths already listed there (such as `node_modules/`, `dist/`, and `build/`) stay out of search results without extra configuration (source: monorepos-and-large-repos.md).

### Block reads of generated and vendored code

For paths that are checked in — a vendored SDK or committed generated code — add `Read` deny rules in `permissions.deny` to block Claude from opening those files even when a search lists them (source: monorepos-and-large-repos.md). Commit them to `.claude/settings.json` to apply for everyone, or use `.claude/settings.local.json` to keep them personal; like other project settings these files load only from the starting directory, so place them at the repository root if you start there or in each package's `.claude/` if you start from subdirectories (source: monorepos-and-large-repos.md). To enforce the same deny rules in every session regardless of starting directory, set them in managed settings, which user and project settings cannot override (source: monorepos-and-large-repos.md).

Deny rules cover Claude's built-in file tools and recognized Bash file commands — including `cat`, `head`, `grep`, and `find` — when a denied path is passed as an argument. They do **not** filter denied paths out of a recursive search's output, and they do **not** cover arbitrary subprocesses that open files themselves (source: monorepos-and-large-repos.md).

### Reduce file reads with code intelligence

Finding where a symbol is defined or used can cost many file reads and grep calls; code-intelligence plugins connect Claude to a language server so it can jump to definitions, find references, and surface type errors directly instead of scanning the tree (source: monorepos-and-large-repos.md). The official marketplace has plugins for TypeScript, Python, Go, Rust, and other common languages — for example `/plugin install typescript-lsp@claude-plugins-official` (source: monorepos-and-large-repos.md). To enable a plugin for everyone rather than installing it yourself, add it to the `enabledPlugins` project setting (source: monorepos-and-large-repos.md). These plugins require the language's language-server binary on each developer's machine plus network access to GitHub for the official marketplace; on a restricted network, add the marketplace from an internal Git host or local path instead (source: monorepos-and-large-repos.md). This pairs well with `claudeMdExcludes` and the `Read` deny rules — those keep irrelevant content out of context while code intelligence keeps Claude from reading through what remains to locate a definition (source: monorepos-and-large-repos.md). See [[claude-code-plugins]] for plugin mechanics.

## Scope worktrees and file access

These settings control what is on disk in worktrees and which directories Claude can read and write beyond your starting point.

### Check out only the directories you need

The `--worktree` flag starts a session in a new git worktree so changes stay isolated from your main checkout; by default it checks out the entire repository, but the `worktree.sparsePaths` setting uses git sparse-checkout to write only the listed directories plus root-level files to disk, so worktrees start faster and use less space (source: monorepos-and-large-repos.md). Paths in `sparsePaths` are **relative to the repository root, regardless of which subdirectory you start Claude from** (source: monorepos-and-large-repos.md).

List directories, not individual files. Root-level **files** like `package.json`, `tsconfig.base.json`, and lock files are always checked out alongside the directories you list, but root-level **directories** are not — include `.claude` explicitly if you want the repository root's `.claude/settings.json`, `.claude/rules/`, or `.claude/skills/` available inside the worktree (source: monorepos-and-large-repos.md). The lists merge across scopes, so a `.claude/settings.local.json` can add paths to a committed list but not remove them (source: monorepos-and-large-repos.md).

This is particularly useful for [[claude-code-subagents]] worktree isolation: subagents are parallel Claude instances spawned for subtasks, and each one running in a worktree gets a lightweight checkout instead of the full tree. **All worktrees in a session share the same `sparsePaths`**, so if one subagent needs `packages/api/` and another needs `packages/web/`, list both (source: monorepos-and-large-repos.md).

To avoid duplicating large directories like `node_modules` across worktrees, pair `sparsePaths` with `symlinkDirectories` in the same `.claude/settings.json`; this symlinks each worktree's `node_modules/` back to the main repository's copy rather than duplicating it on disk (source: monorepos-and-large-repos.md).

`sparsePaths` and `symlinkDirectories` are read from your starting directory **before** the worktree is created. After creation, the session's working directory is the worktree root, not the subdirectory you launched from, so project settings inside the worktree load from the worktree root's `.claude/settings.json` (the checked-out copy of the repository root's file). Put any other settings you need inside worktrees — permission rules or hooks — in the repository root's `.claude/settings.json` (source: monorepos-and-large-repos.md).

### Grant access across packages or repositories

This applies when you start Claude from a subdirectory, or when a task spans multiple checkouts; if you start from the root in a single large tree, Claude already has every file and you can skip it (source: monorepos-and-large-repos.md). When you start from `packages/api/` but a task requires changes across packages — for example updating a shared type both `api` and `web` import — grant access to the sibling directory; the same mechanism reaches a separately-checked-out repository (source: monorepos-and-large-repos.md).

The `additionalDirectories` setting in `.claude/settings.json` gives Claude access to directories outside the working directory, with relative paths resolving against the directory you start Claude from (source: monorepos-and-large-repos.md). You can also grant access at runtime without editing settings by passing `--add-dir` when you start Claude, e.g. `claude --add-dir ../shared` (source: monorepos-and-large-repos.md).

However you add a directory, Claude can read and edit files in it — but whether the directory's CLAUDE.md, `.claude/rules/` files, and skills also load depends on how you added it (source: monorepos-and-large-repos.md):

- The **`additionalDirectories` setting** grants file access only — it **never** loads CLAUDE.md, rules, or skills (source: monorepos-and-large-repos.md).
- The **`--add-dir` flag or `/add-dir` command** always loads the directory's skills, and loads its CLAUDE.md and rules only when the `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` environment variable is set (source: monorepos-and-large-repos.md).

That environment variable has **no effect** on directories listed in the `additionalDirectories` setting (source: monorepos-and-large-repos.md). Commit `additionalDirectories` to `.claude/settings.json` for sibling directories everyone needs; use `.claude/settings.local.json` or pass `--add-dir` for a personal or one-off selection (source: monorepos-and-large-repos.md).

## Add per-directory skills

Any subdirectory can define [[claude-code-skills]] scoped to its own stack, under `.claude/skills/` inside the directory; a skill loads on demand when Claude determines it is relevant, so API-specific tooling does not consume context during frontend work (source: monorepos-and-large-repos.md). Commit skills alongside that area's code so anyone who clones the repository gets them — one set per package in a monorepo, one per subsystem such as `src/db/.claude/skills/` in a single tree (source: monorepos-and-large-repos.md). You can also scope a skill by file pattern instead of by placement: the `paths` frontmatter field takes glob patterns, and Claude loads the skill automatically only when it works with matching files — useful for a skill in the repository root's `.claude/skills/` that applies only to certain files wherever they appear, such as a database-migration skill scoped to `**/migrations/**` (source: monorepos-and-large-repos.md).

### Keep skills discoverable

Which skills are in scope depends on where you start Claude (source: monorepos-and-large-repos.md):

- **From a subdirectory** such as `packages/api/`: skills from that directory, every parent up to the repository root, and the user and enterprise levels (source: monorepos-and-large-repos.md).
- **From the repository root**: skills from every subdirectory Claude touches during the session, which can accumulate into the hundreds (source: monorepos-and-large-repos.md).
- **After adding a sibling with `--add-dir`**: that sibling's skills load too; the `additionalDirectories` setting grants file access only and does not load skills (source: monorepos-and-large-repos.md).

Claude picks a skill by reading every discovered skill's name and description, and only the chosen skill's full content loads. Names always load, but **descriptions are shortened when there are many**, which can strip the keywords Claude uses to decide whether a skill applies — so keep descriptions short and lead with words a request would contain, like "writing or modifying tests in `packages/api/`" (source: monorepos-and-large-repos.md). Place skills many directories share (PR conventions, a deploy checklist) in the repository root's `.claude/skills/` so they load from any starting directory; when shared skills need their own version history or must work across repositories, package them as a plugin instead, where plugin skills use a `plugin-name:skill-name` namespace so they never collide with per-directory skills (source: monorepos-and-large-repos.md). To find unused skills, enable the OpenTelemetry logs exporter with `OTEL_LOG_TOOL_DETAILS=1` so skill names are recorded verbatim; the `skill_activated` event records every invocation and `invocation_trigger` records whether a command, Claude, or a nested skill invoked it, telling you what to consolidate or retire (source: monorepos-and-large-repos.md).

## Centralize conventions when layering stops scaling

Per-directory CLAUDE.md files become hard to govern as the codebase grows: conventions drift, files go stale, and no one owns the root — solving that typically falls to the team that maintains the repository's Claude Code setup rather than to each developer (source: monorepos-and-large-repos.md). Move conventions and reference content out of always-loaded CLAUDE.md and into mechanisms that load on demand — a direct application of [[context-engineering]] (source: monorepos-and-large-repos.md):

- **Skills**: reference material Claude loads only when relevant to the task (source: monorepos-and-large-repos.md).
- **Plugins**: versioned bundles of skills, hooks, and commands that a platform team owns centrally — see [[claude-code-plugins]] (source: monorepos-and-large-repos.md).
- **MCP servers**: if your organization already runs a code search or RAG index over the repository, expose it as an MCP tool so Claude queries it instead of reading files directly (source: monorepos-and-large-repos.md).

Once conventions live in plugins, a teammate starting Claude in an unfamiliar part of the tree has no signal about which plugin that area's owners maintain. A `SessionStart` hook can close that gap, since anything the hook prints to stdout is added to Claude's context before the first prompt — a script can read the launch directory from the hook input, look it up in a path-to-plugin map committed to the repository, and print the recommendation for Claude to relay (source: monorepos-and-large-repos.md). See [[claude-code-hooks]] for `SessionStart`.

## Put it together

Each subdirectory's `.claude/settings.json` must be self-contained, because project settings load only from the directory you start Claude in (source: monorepos-and-large-repos.md). A committed `packages/api/.claude/settings.json` can carry `worktree.sparsePaths` + `symlinkDirectories`, `permissions.additionalDirectories`, and `Read` deny rules so every developer in `packages/api/` gets the same sibling access, sparse paths, and exclusions (source: monorepos-and-large-repos.md).

Because that session starts from `packages/api/`, sibling packages' CLAUDE.md files are already out of scope, so `claudeMdExcludes` is not needed there — add it to the repository root's `.claude/settings.local.json` only if you also start sessions from the root (source: monorepos-and-large-repos.md). Inside a worktree created from this session the working directory is the worktree root, so the `packages/api/` settings file does not load; the sibling packages are still reachable, but the deny rules need a second copy in the repository root's `.claude/settings.json` so worktree sessions pick them up (source: monorepos-and-large-repos.md).

With this setup, starting Claude from `packages/api/` loads the root CLAUDE.md and `packages/api/CLAUDE.md` (skipping `packages/web/CLAUDE.md`), can read and edit files in `packages/api/` and `packages/shared/`, skips reads of build output under `dist/` and `build/`, has the api-testing skill available on demand, and creates worktrees containing `.claude/`, `packages/api/`, `packages/shared/`, and root-level files with the deny rules applied from the root settings file (source: monorepos-and-large-repos.md).

## Scope and plan changes that span packages

The configuration above controls what Claude sees; when a single change touches several packages, how you scope and sequence the task also affects the result (source: monorepos-and-large-repos.md). Two techniques help keep a cross-package change consistent: hand Claude the whole change in one session — the shared edit and its call sites together — so decisions stay consistent rather than re-derived per package; and save the plan to a markdown file in the repository before editing, because a long cross-package session compacts its context along the way and the saved plan survives where conversation history may not (source: monorepos-and-large-repos.md). Saving the plan to a durable file is the structured note-taking pattern from [[context-engineering]].

## Related pages
- [[claude-code-memory]]
- [[claude-code-skills]]
- [[claude-code-plugins]]
- [[claude-code-hooks]]
- [[claude-code-subagents]]
- [[context-engineering]]
- [[progressive-disclosure]]
- [[agent-configuration-files]]
