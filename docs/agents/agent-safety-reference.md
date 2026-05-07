Detailed reference for [.github/instructions/agent-safety.instructions.md](../../.github/instructions/agent-safety.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# Agent Safety & Governance — Deep Reference

## Code Pattern Examples

### Tool Access — Good vs Bad

```python
# Good: Governed tool with explicit policy
@govern(policy)
async def search(query: str) -> str:
    ...

# Bad: Unprotected tool with no governance
async def search(query: str) -> str:
    ...
```

### Policy Definition — Good vs Bad

```yaml
# Good: Explicit allowlist, content filters, rate limit
name: my-agent
allowed_tools: [search, summarize]
blocked_patterns: ["(?i)(api_key|password)\\s*[:=]"]
max_calls_per_request: 25

# Bad: No restrictions
name: my-agent
allowed_tools: ["*"]
```

### Multi-Agent Policy Composition — Good vs Bad

```python
# Good: Most-restrictive-wins composition
final_policy = compose_policies(org_policy, team_policy, agent_policy)

# Bad: Only using agent-level policy, ignoring org constraints
final_policy = agent_policy
```

## Audit Log Format

JSON Lines format for log aggregation compatibility:

```jsonl
{"timestamp": "2024-01-15T10:30:00Z", "session_id": "abc123", "event": "session_start"}
{"timestamp": "2024-01-15T10:30:01Z", "agent_id": "search-agent", "tool": "web_search", "decision": "allow", "policy": "default", "matched_rule": null}
{"timestamp": "2024-01-15T10:30:02Z", "agent_id": "search-agent", "tool": "file_delete", "decision": "deny", "policy": "default", "matched_rule": "blocklist:file_deletion"}
{"timestamp": "2024-01-15T10:30:10Z", "session_id": "abc123", "event": "session_end"}
```

Key log fields per tool call:
- `timestamp` — ISO 8601
- `agent_id` — which agent made the call
- `tool` — tool name
- `decision` — `allow` or `deny`
- `policy` — which policy was applied
- `matched_rule` — which rule triggered the decision (for denials and violations)

Note: do NOT log raw user prompts — log decisions and metadata only.

## Trust Score Pattern for Multi-Agent Delegation

```python
class AgentTrust:
    def __init__(self, initial_score: float = 1.0):
        self.score = initial_score
        self.decay_rate = 0.05  # Decay per time period without positive signal

    def on_success(self) -> None:
        self.score = min(1.0, self.score + 0.01)

    def on_failure(self) -> None:
        self.score = max(0.0, self.score - 0.2)

    def on_time_decay(self) -> None:
        self.score = max(0.0, self.score - self.decay_rate)

    def is_trusted(self, threshold: float = 0.5) -> bool:
        return self.score >= threshold
```

## Content Filtering Pattern

Regex patterns loaded from configuration, not hardcoded:

```yaml
# content-filters.yaml
blocked_patterns:
  - "(?i)(api_key|secret_key|password|passwd|token)\\s*[:=]\\s*\\S+"
  - "(?i)(select|insert|update|delete|drop|alter)\\s+.*\\s+from\\s+"
  - "(?i)\\b(ssn|social.security|credit.card)\\b"
```

```python
import re
import yaml

def load_content_filters(config_path: str) -> list[re.Pattern]:
    with open(config_path) as f:
        config = yaml.safe_load(f)
    return [re.compile(p) for p in config["blocked_patterns"]]

def scan_for_threats(text: str, patterns: list[re.Pattern]) -> list[str]:
    return [p.pattern for p in patterns if p.search(text)]
```

## Framework Integration Notes

### PydanticAI

PydanticAI's upcoming Traits feature is designed for the governance decorator pattern. Until then, use a standard decorator wrapper around `@agent.tool` functions.

### CrewAI

Apply governance at the Crew level, not just individual Agent level, so all agents in the crew are covered. The `before_kickoff` hook is the correct place for policy validation — runs before any agent execution begins.

### OpenAI Agents SDK

Use handoff guards to enforce trust policies when agents delegate to other agents. The guard runs before the handoff is accepted.

### LangChain/LangGraph

Apply governance at the graph edge level for flow control. `RunnableBinding` wraps tool calls with pre/post hooks. For streaming, ensure governance hooks run on the full assembled tool call, not on partial chunks.

### AutoGen

The `ConversableAgent.register_for_execution` hook fires before any tool execution. Use this to validate tool name and arguments against the active policy.

## Rate Limiting Pattern

```python
class ToolRateLimiter:
    def __init__(self, max_calls: int):
        self.max_calls = max_calls
        self.call_count = 0

    def check_and_increment(self, tool_name: str) -> bool:
        """Returns True if call is allowed; False if rate limit exceeded."""
        if self.call_count >= self.max_calls:
            return False
        self.call_count += 1
        return True

    def reset(self) -> None:
        self.call_count = 0
```

## Policy Hierarchy

For multi-tenant or multi-level deployments, always compose policies in this precedence order (most restrictive wins):

1. Organization policy (highest precedence)
2. Team policy
3. Agent-specific policy (lowest precedence)

If any level denies a tool, the final decision is deny, regardless of what other levels permit.
