---
applyTo: ['*']
description: "Comprehensive best practices for AI prompt engineering, safety frameworks, bias mitigation, and responsible AI usage for Copilot and LLMs."
---

# AI Prompt Engineering & Safety Best Practices

## Prompt Design Rules

- State tasks clearly and concisely; specify output format and length constraints.
- Provide relevant context: domain terminology, target audience, applicable standards.
- Use zero-shot for simple tasks; few-shot (2-3 examples) for complex or format-specific tasks.
- Use chain-of-thought prompting for multi-step reasoning problems.
- Use role prompting to set expertise context when specialized knowledge matters.
- Avoid vague instructions, unnecessary verbosity, and redundant details.
- Never interpolate untrusted user input directly into prompts — sanitize and validate first.
- Avoid overfitting prompts to specific examples; express general principles and patterns.

## Safety & Bias Mitigation

- Red-team prompts: test edge cases, adversarial inputs, and failure modes before deployment.
- Run safety checklists on outputs: harmful content, bias/discrimination, privacy violations, misinformation, dangerous behavior.
- Use inclusive, neutral language; avoid assumptions about users, roles, or backgrounds.
- Integrate content moderation APIs for automated safety screening.
- Include human-in-the-loop review for sensitive or high-risk prompt outputs.
- Test outputs for demographic bias; include diverse test cases.

## Security

- Never interpolate raw user input: `const prompt = \`...: ${userInput}\`` is a prompt-injection vulnerability.
- Validate input format, length, and content; strip or escape dangerous patterns.
- Never echo sensitive data back in AI outputs; redact or replace with placeholders.
- Encrypt data in transit and at rest; implement access controls for AI-powered features.
- Maintain audit logs of prompt inputs, outputs, and safety-check results.

## Responsible AI & Compliance

- Document prompt intent, scope, limitations, and assumptions.
- Inform users when AI is being used; provide opt-out where appropriate.
- Avoid including personal information in prompts; apply data minimization.
- Set data retention limits: expire stored prompts, outputs, and logs after the period required by policy or regulation.
- Maintain audit trails for compliance (GDPR, HIPAA, and applicable regulations).
- Align with applicable AI principles frameworks (Microsoft, Google, OpenAI usage policies).
- Follow ISO/IEC 42001:2023 and NIST AI Risk Management Framework where relevant.

## Testing & Validation

- Define test cases with explicit expected outputs and safety criteria before deploying prompts.
- Run regression tests when prompts change to ensure existing behavior is preserved.
- Track metrics: success rate, safety-incident count, user satisfaction, response consistency.
- Version-control prompts; document rationale for each change.
- Peer-review prompts before production use; document review decisions.

## Prompt Design Checklist

- [ ] Task clearly stated with specific, unambiguous instructions
- [ ] Output format and length constraints specified
- [ ] Sufficient context provided for the target audience
- [ ] Safety considerations addressed; harmful-output scenarios red-teamed
- [ ] Bias mitigation applied: neutral language, diverse test cases
- [ ] Input validation and sanitization in place (no raw user-input interpolation)
- [ ] Privacy: no personal data included in prompts; sensitive output redacted
- [ ] Test cases with success criteria defined and passing
- [ ] Prompt versioned and changes documented

For deep guidance, see [docs/agents/ai-prompt-engineering-reference.md](../../docs/agents/ai-prompt-engineering-reference.md).
