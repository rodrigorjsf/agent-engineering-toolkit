---
description: 'Guidelines for building safe, governed AI agent systems. Apply when writing code that uses agent frameworks, tool-calling LLMs, or multi-agent orchestration to ensure proper safety boundaries, policy enforcement, and auditability.'
applyTo: '**'
---

# Agent Safety & Governance

## Core Principles

- **Fail closed**: If a governance check errors or is ambiguous, deny the action rather than allowing it.
- **Policy as configuration**: Define governance rules in YAML/JSON files, not hardcoded in application logic.
- **Least privilege**: Agents should have the minimum tool access needed for their task.
- **Append-only audit**: Never modify or delete audit trail entries — immutability enables compliance.

## Tool Access Controls

- Always define an explicit allowlist of tools an agent can use — never give unrestricted tool access.
- Separate tool registration from tool authorization.
- Use blocklists for known-dangerous operations (shell execution, file deletion, database DDL).
- Require human-in-the-loop approval for high-impact tools (send email, deploy, delete records).
- Enforce rate limits on tool calls per request to prevent infinite loops and resource exhaustion.

## Content Safety

- Scan all user inputs for threat signals before passing to the agent (data exfiltration, prompt injection, privilege escalation).
- Filter agent arguments for sensitive patterns: API keys, credentials, PII, SQL injection.
- Use regex pattern lists that can be updated without code changes.
- Check both the user's original prompt AND the agent's generated tool arguments.

## Multi-Agent Safety

- Each agent in a multi-agent system must have its own governance policy.
- When agents delegate to other agents, apply the most restrictive policy from either.
- Track trust scores for agent delegates — degrade trust on failures; require ongoing good behavior.
- Never allow an inner agent to have broader permissions than the outer agent that called it.

## Audit & Observability

- Log every tool call with: timestamp, agent ID, tool name, allow/deny decision, policy name.
- Log every governance violation with the matched rule and evidence.
- Export audit trails in JSON Lines format for log aggregation system integration.
- Include session boundaries (start/end) in audit logs for correlation.
- Log decisions and metadata — do NOT log raw user prompts in audit trails.

## Code Patterns

- Wrap tool functions with a governance decorator: `@govern(policy) async def search(query: str)`.
- Define policies explicitly: `allowed_tools: [search, summarize]`, `blocked_patterns: [...]`, `max_calls_per_request: 25`.
- Never use `allowed_tools: ["*"]` — always enumerate permitted tools.
- Multi-agent policy composition: use most-restrictive-wins — `final_policy = compose_policies(org_policy, team_policy, agent_policy)`.

## Framework-Specific Notes

- **PydanticAI**: Use `@agent.tool` with a governance decorator wrapper.
- **CrewAI**: Apply governance at the Crew level; use `before_kickoff` callbacks for policy validation.
- **OpenAI Agents SDK**: Wrap `@function_tool` with governance; use handoff guards for multi-agent trust.
- **LangChain/LangGraph**: Use `RunnableBinding` or tool wrappers; apply at graph edge level for flow control.
- **AutoGen**: Implement governance in the `ConversableAgent.register_for_execution` hook.

## Common Mistakes

- Relying only on output guardrails (post-generation) instead of pre-execution governance.
- Hardcoding policy rules instead of loading from configuration.
- Allowing agents to self-modify their own governance policies.
- Forgetting to governance-check tool *arguments*, not just tool *names*.
- Not decaying trust scores over time — stale trust is dangerous.
- Logging raw prompts in audit trails — log decisions and metadata only.

For deep guidance, see [docs/agents/agent-safety-reference.md](../../docs/agents/agent-safety-reference.md).
