# cursor-code-documentation

A deployable-behavior Cursor plugin that ships an always-apply rule making the
agent add language-idiomatic inline documentation whenever it writes, modifies,
or creates code. Unlike the initializer and customizer plugins in this
marketplace, this plugin delivers behavior on install — no artifact generation
step required.

The plugin bundles one always-apply rule and two manual-only skills:

- **`document-as-you-code` rule** — active on every turn, instructs the agent
  to add idiomatic documentation in the correct format for each language,
  including scripts.
- **`code-explain` skill** — deliberate, on-demand explanation of existing code
  sections.
- **`doc-generate` skill** — deliberate, on-demand generation of documentation
  for a file or module.

## Cost and Model Guidance

The `document-as-you-code` rule is always-apply and injects a small, fixed
prompt into every agent turn. Its token cost is negligible — roughly 30 tokens
per turn regardless of project size.

The two manual skills (`code-explain`, `doc-generate`) perform heavier analysis
and are invoked explicitly. Their cost scales with the size of the code section
or file being documented.

**Recommended model:** any capable frontier model works well for the always-apply
rule. For the manual skills, a frontier balanced model with high effort delivers
good documentation quality at reasonable cost; a frontier reasoning model is
the better choice for large or complex codebases.

**Usage pattern:** install once, leave the rule active. Invoke the manual skills
when you need comprehensive documentation for an existing file or module — not
on every session.

## Why This Plugin Exists

Agents write undocumented code by default. Adding a documentation instruction
after the fact either goes unnoticed or requires a separate prompt every
session. An always-apply rule is the only reliable per-turn injection surface
in Cursor (verified against official docs and Cursor forum 2026-06-21:
`beforeSubmitPrompt` is block-only, `afterFileEdit` cannot feed the model, and
`sessionStart` injection is currently broken).

Shipping the rule as a plugin artifact means the behavior travels with the
plugin, loads on install, and applies without any per-project configuration.

## Installation

### Cursor IDE (Native Plugin System)

For local development and testing, load this repository through Cursor's local
plugin directory:

```bash
# Clone the repository
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git ~/src/agent-engineering-toolkit

# Register as a local Cursor plugin marketplace
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/agent-engineering-toolkit ~/.cursor/plugins/local/agent-engineering-toolkit
```

Then restart Cursor (or run **Developer: Reload Window**). The repo root
`.cursor-plugin/marketplace.json` exposes `cursor-code-documentation` alongside
the other plugins in this marketplace.

## Usage

The `document-as-you-code` rule is always active after installation — no
invocation required.

The manual skills are invoked explicitly:

```text
/cursor-code-documentation:code-explain    # explain an existing code section
/cursor-code-documentation:doc-generate    # generate documentation for a file or module
```

The `document-as-you-code` rule is always active after installation; the two
manual skills ship alongside it and are invoked explicitly.

## Repository Structure

```text
plugins/cursor-code-documentation/
├── .cursor-plugin/
│   └── plugin.json           # Plugin manifest (name, version, description)
├── .cursor/
│   └── rules/
│       └── document-as-you-code.mdc   # Always-apply documentation rule
└── skills/
    ├── code-explain/
    │   └── SKILL.md          # Manual-only: explain an existing code section
    └── doc-generate/
        └── SKILL.md          # Manual-only: generate documentation for a file or module
```

## License

MIT
