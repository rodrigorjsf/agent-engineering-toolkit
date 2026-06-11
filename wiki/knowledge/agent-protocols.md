# Agent Protocols

**Summary**: Covers the emerging standards — MCP, A2A, ANP, and the merged ACP — that enable AI agents to connect to tools, collaborate with other agents, and interoperate across organizational boundaries. Explains the M×N integration problem, the complementary roles of each protocol, and how to choose between them.
**Sources**: a2a-protocol-huggingface-space.md, advancing-agentic-ai-communication-protocols.md, ai-agent-protocols-2026-guide.md, anthropic-engineer-2026-forecast-full-connectivity-mcp.md, architectural-paradigms-advanced-agentic-systems.md
**Last updated**: 2026-05-01

---

## The M×N Integration Problem

Before standardized protocols, integrating AI agents with external tools was a combinatorial nightmare. Every agent needing access to Slack, GitHub, a CRM, and a database required four separate, bespoke connectors. With M agents and N tools, the ecosystem needed M×N custom integrations — each with its own authentication handling, data format, and error behavior (source: architectural-paradigms-advanced-agentic-systems.md).

The Model Context Protocol collapses this to M+N implementations. Each tool exposes one MCP server; each agent implements one MCP client. This is the same insight behind USB-C for hardware or npm for JavaScript packages (source: ai-agent-protocols-2026-guide.md).

The same fragmentation problem existed at the agent-to-agent level: when one agent needed to delegate a subtask to a specialist agent built on a different framework, the teams had to negotiate custom point-to-point protocols. A2A solves this at the agent-collaboration layer.

---

## MCP: The Agent-to-Tool Standard

**Model Context Protocol** (Anthropic, November 2024) is the de facto standard for connecting AI agents to external tools, data sources, and services (source: ai-agent-protocols-2026-guide.md).

### Architecture

MCP uses a JSON-RPC based client-server model. MCP Clients (agents) connect to MCP Servers that expose tools, resources, and prompts from external systems. Transport is Streamable HTTP (replacing the earlier SSE-only approach) or stdio (source: ai-agent-protocols-2026-guide.md).

Key capabilities in the 2025-11-25 spec:
- **Tool exposure** — servers declare callable functions with typed schemas
- **Resource access** — structured data retrieval from any connected system
- **Elicitation** — servers can request structured input from users mid-workflow, including URL-mode elicitation for secure credential collection
- **Sampling** — servers can request LLM completions through the client, now with tool-calling support
- **Tasks (experimental)** — durable request tracking with polling and deferred results

### Governance and Adoption

Anthropic donated MCP to the Agentic AI Foundation (AAIF) under the Linux Foundation in December 2025 (source: ai-agent-protocols-2026-guide.md). Adoption has been rapid:

- **97 million** monthly SDK downloads as of March 2026 (source: anthropic-engineer-2026-forecast-full-connectivity-mcp.md)
- **10,000+** active MCP servers in production
- OpenAI adopted MCP across its Agents SDK and ChatGPT desktop in March 2025
- Google DeepMind confirmed support in Gemini; Microsoft embedded it in Windows 11 and Copilot

SDKs are available in Python, TypeScript, C#, and Java.

### What MCP Does Not Do

MCP is intentionally scoped to agent-to-tool connectivity. It does not handle agent-to-agent communication — that is A2A's domain. This separation by design is a feature, not a gap (source: a2a-protocol-huggingface-space.md).

---

## A2A: The Agent-to-Agent Standard

**Agent-to-Agent Protocol** (Google, April 2025) addresses a different question: how do agents from different vendors, frameworks, and organizations collaborate on tasks without sharing internal logic? (source: ai-agent-protocols-2026-guide.md)

Where MCP connects agents to tools, A2A connects agents to other agents. It treats each agent as an opaque service — neither agent needs to know whether the other runs on LangChain, CrewAI, or a custom framework.

### Architecture

A2A uses HTTP-based communication with JSON-RPC messaging and Server-Sent Events (SSE) for streaming. It builds on established web standards for maximum enterprise compatibility (source: ai-agent-protocols-2026-guide.md).

### Agent Cards

The central discovery mechanism is the **Agent Card**: a JSON metadata document discoverable at `/.well-known/agent.json`. It describes the agent's identity, capabilities, skills, endpoint URLs, authentication requirements, and supported input/output modes (source: a2a-protocol-huggingface-space.md).

```typescript
interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapabilities;
  skills: AgentSkill[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  securitySchemes?: { [scheme: string]: SecurityScheme };
}
```

Clients discover agents by reading their Agent Cards, analogous to an OpenAPI spec for agents.

### Task Lifecycle

A2A communication is task-oriented. When a client agent sends a message, the remote agent may determine that fulfilling the request requires a task. Each task has a unique ID and progresses through a defined lifecycle:

`submitted` → `working` → `input-required` → `completed` / `failed`

Tasks are stateful and may involve multiple message exchanges (source: a2a-protocol-huggingface-space.md).

### Communication Elements

- **Message** — a single turn with a `role` (user or agent) and one or more `Part` objects
- **Part types** — `TextPart`, `FilePart`, `DataPart` (structured JSON)
- **Artifact** — output results generated during task processing (documents, images, data)
- **Interaction modes** — synchronous polling via `message/send`, streaming via `message/stream` with SSE, and push notifications via webhooks for long-running tasks

### Governance

Google donated A2A to the Linux Foundation in June 2025. The Technical Steering Committee includes Google, Microsoft, AWS, Cisco, Salesforce, ServiceNow, SAP, and IBM. Over 50 industry partners are actively contributing (source: ai-agent-protocols-2026-guide.md).

---

## ACP and Its Merger into A2A

**Agent Communication Protocol** (IBM Research, March 2025) was a REST-native approach to agent interoperability with multipart message format support. In September 2025, IBM announced that ACP would officially merge into A2A under the Linux Foundation — a recognition that two competing agent-to-agent standards created unnecessary fragmentation (source: ai-agent-protocols-2026-guide.md).

As of 2026, ACP is deprecated. Development effort and contributors have migrated to A2A. Anyone building on ACP should follow IBM's migration guide to A2A (source: ai-agent-protocols-2026-guide.md).

---

## ANP: Decentralized Agent Networks

**Agent Network Protocol** addresses agent discovery and collaboration in open, decentralized networks. Where A2A assumes agents interact within known organizational boundaries, ANP handles the case where agents need to discover each other in open internet-scale networks.

ANP uses **Decentralized Identifiers (DIDs)** for identity and **JSON-LD semantic graphs** for capability description, enabling peer discovery without central directories (source: advancing-agentic-ai-communication-protocols.md).

ANP is less mature than MCP or A2A and is primarily relevant for decentralized or open-web agent scenarios rather than enterprise integration.

---

## MCP and A2A are Complementary, Not Competing

The "socket wrench vs. conversation between mechanics" framing captures the relationship:

- **MCP** is the socket wrench: standardized connection for any agent to any tool (source: a2a-protocol-huggingface-space.md)
- **A2A** is the conversation: how mechanics (agents) coordinate on who does what

A practical enterprise architecture uses both:

**Layer 1 — Tool Access (MCP):** Each agent connects to its tools via MCP servers (CRM agent → Salesforce; analytics agent → data warehouse; code agent → GitHub).

**Layer 2 — Agent Coordination (A2A):** When agents collaborate, A2A handles the handoff. A CRM agent discovers the analytics agent's capabilities through its Agent Card, submits a task, and receives structured results.

**Layer 3 — Orchestration:** A supervisory agent coordinates the pipeline, using A2A for task delegation and MCP for its own tooling (source: ai-agent-protocols-2026-guide.md).

---

## The Paradigm Shift: Away from REST-Wrapping

Anthropic engineer David Soria Parra, speaking on the AI Engineer podcast, identified a common mistake: mechanically converting REST APIs to MCP servers. He described this as "cringe" because it ignores why MCP was designed (source: anthropic-engineer-2026-forecast-full-connectivity-mcp.md).

REST APIs were designed for deterministic, step-by-step orchestration. They require multiple sequential calls to complete a single logical task. Wrapping them preserves that sequential bottleneck inside an agentic workflow.

### Agent-Native Interface Design

The alternative is designing interfaces specifically for agent interaction — interfaces that:
- Accept programmatic, low-latency tool composition rather than one-call-at-a-time workflows
- Enable agents to write code that composes multiple tool calls in a single operation
- Return only high-signal information relevant to the agent's next reasoning step

### Programmatic Tool Composition

The modern pattern shifts from sequential tool-calling to programmatic execution:

**Sequential (legacy):** Agent calls Tool A → waits → calls Tool B → waits → calls Tool C

**Programmatic (modern):** Agent writes a small script that composes A, B, and C → executes in one operation

This reduces LLM round-trips from N (one per tool) to 2 (fixed), with 80%+ token savings on complex workflows (source: programmatic-tool-calling-claude-api.md).

### Skills over MCP

A key innovation in the MCP ecosystem is "skills over MCP" — allowing server authors to bundle updated domain knowledge, prompts, and capabilities directly within the MCP server itself. This creates a decentralized, dynamic update model: an agent connecting to a server immediately gains access to its latest capabilities without any central app store approval process (source: anthropic-engineer-2026-forecast-full-connectivity-mcp.md).

This pattern is directly relevant to how [[claude-code-skills]] are structured and distributed.

---

## The 2026 Full Connectivity Stack

Parra's forecast is that the most powerful 2026 agents will use a pragmatic combination of all available connectivity methods rather than debating which single approach is best (source: anthropic-engineer-2026-forecast-full-connectivity-mcp.md):

- **Computer use** (GUI automation)
- **Command-line interfaces (CLIs)**
- **Model Context Protocol (MCP)** with server discovery and skills-over-MCP
- **Packaged skills** (domain knowledge bundles)

This "full connectivity" vision treats each method as appropriate for different situations rather than competitive alternatives.

---

## Architectural Paradigms: Symbolic vs. Neural/Generative

Protocol choice intersects with a deeper architectural axis. A 2025 survey (arXiv:2510.25445) introduces a dual-paradigm framework distinguishing (source: architectural-paradigms-advanced-agentic-systems.md):

**Symbolic/Classical systems:**
- Foundation: algorithmic planning, explicit rules, persistent state
- Strengths: predictability, traceability, deterministic behavior
- Dominant domains: safety-critical applications (healthcare, medical diagnosis)
- Governance: well-understood accountability chains

**Neural/Generative systems:**
- Foundation: LLMs, stochastic generation, prompt-driven orchestration
- Strengths: adaptability, generalization, contextual reasoning
- Dominant domains: finance, robotics, dynamic real-world environments
- Governance: significant challenge requiring new accountability frameworks

The research emphasizes that neither paradigm dominates absolutely — the future is intentional integration that combines symbolic reliability with neural adaptability. Protocol standardization (MCP, A2A) applies to both paradigms, but governance frameworks must be tailored to each paradigm's risk profile (source: architectural-paradigms-advanced-agentic-systems.md).

---

## Decision Framework

| Situation | Protocol |
|-----------|----------|
| Agent needs tool access (databases, APIs, SaaS) | MCP |
| Single-agent applications | MCP |
| Plug-and-play integrations from existing ecosystem | MCP (10,000+ servers) |
| Multiple agents collaborating on a pipeline | A2A |
| Cross-organizational agent coordination | A2A |
| Vendor-agnostic orchestration (LangChain + AutoGen etc.) | A2A |
| Long-running async workflows across boundaries | A2A |
| Enterprise multi-agent systems | Both (most common) |
| Open-internet, decentralized agent discovery | ANP |

The rule of thumb: MCP for everything an agent does alone with external tools; A2A for everything agents do together (source: ai-agent-protocols-2026-guide.md).

---

## Related pages

- [[context-engineering]]
- [[agent-workflows]]
- [[subagents]]
- [[claude-code-skills]]
- [[claude-code-plugins]]
- [[progressive-disclosure]]
- [[claude-code-mcp]] — practical Claude Code implementation reference for MCP integration
