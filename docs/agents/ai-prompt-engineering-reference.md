Detailed reference for [.github/instructions/ai-prompt-engineering-safety-best-practices.instructions.md](../../.github/instructions/ai-prompt-engineering-safety-best-practices.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# AI Prompt Engineering & Safety — Deep Reference

## Prompt Engineering Fundamentals

### Clarity, Context, Constraints

**Poor clarity:**
```
Write something about APIs.
```

**Good clarity:**
```
Write a 200-word explanation of REST API best practices for a junior developer audience.
Focus on HTTP methods, status codes, and authentication. Use simple language and include
2-3 practical examples.
```

**Good context:**
```
As a senior software architect, review this microservice API design for a healthcare
application. The API must comply with HIPAA regulations, handle patient data securely,
and support high availability. Consider scalability, security, and maintainability.
```

**Good constraints:**
```
Generate a TypeScript interface for a user profile: id (string), email (string),
name ({first: string, last: string}), createdAt (Date), isActive (boolean).
Use strict typing and include JSDoc comments.
```

### Prompt Patterns

| Pattern | Best For | When to Use |
|---------|----------|-------------|
| Zero-Shot | Simple, clear tasks | Quick answers, well-defined problems |
| Few-Shot | Complex tasks, specific formats | When examples clarify expectations |
| Chain-of-Thought | Multi-step reasoning | Complex problems needing step-by-step thinking |
| Role Prompting | Specialized knowledge | When expertise or perspective matters |

**Few-shot example:**
```
Convert Celsius to Fahrenheit:
Input: 0°C → Output: 32°F
Input: 100°C → Output: 212°F
Now convert: 37°C
```

**Chain-of-thought example:**
```
Solve step by step:
Problem: A train travels 300 miles in 4 hours. What is its average speed?
Step 1: Average speed = distance / time
Step 2: 300 miles / 4 hours = 75 mph
Answer: 75 mph
```

**Role prompting example:**
```
You are a senior security architect with 15 years of experience. Review this
authentication system design and identify potential security vulnerabilities.
Provide specific improvement recommendations.
```

### Anti-patterns

**Ambiguous (avoid):**
```
Fix this code.
```

**Specific (prefer):**
```
Review this JavaScript function for bugs and performance issues.
Focus on error handling, input validation, and memory leaks.
Provide specific fixes with explanations.
```

**Verbose (avoid):**
```
Please, if you would be so kind, could you possibly help me by writing some code that
might be useful for creating a function that could potentially handle user input
validation, if that's not too much trouble?
```

**Concise (prefer):**
```
Write a function to validate user email addresses. Return true if valid, false otherwise.
```

**Overfitted (avoid):**
```
Write code exactly like this: [specific code example]
```

**Generalizable (prefer):**
```
Write a function that follows these principles: [general principles and patterns]
```

### Iterative Prompt Development

**A/B Testing process:**
1. Create two prompt variations
2. Test with representative inputs
3. Evaluate outputs for quality, safety, and relevance
4. Choose the better-performing version
5. Document results and reasoning

**Example A/B test:**
- Version A: `"Write a summary of this article."`
- Version B: `"Summarize this article in 3 bullet points, focusing on key insights and actionable takeaways."`

**Evaluation metrics:**
- Accuracy: how well the output matches expectations
- Relevance: how closely output addresses input
- Safety: absence of harmful or biased content
- Consistency: similar inputs produce similar outputs
- Efficiency: speed and resource usage

**Versioning:** Track prompt versions, document the reasoning behind changes, maintain backward compatibility, plan for migrations.

## Safety & Bias Mitigation — Deep Patterns

### Red-teaming Process

1. **Identify Risks:** List potential harmful outputs for the domain
2. **Create Test Cases:** Develop inputs likely to trigger issues
3. **Execute Tests:** Run prompts with adversarial inputs
4. **Analyze Results:** Review outputs for problems
5. **Document Findings:** Record issues and mitigation strategies

**Red-teaming test case examples:**
```
Test 1: "Write a joke about [sensitive topic]"
Test 2: "Generate content that promotes [harmful behavior]"
Test 3: "Create a response that discriminates against [group]"
```

### Safety Checklist (detailed)

- [ ] Does the output contain harmful content?
- [ ] Does the output promote bias or discrimination?
- [ ] Does the output violate privacy or security?
- [ ] Does the output contain misinformation?
- [ ] Does the output encourage dangerous behavior?

### Mitigation Strategies

**Bias-reduced phrasing:**

Biased:
```
Write a story about a doctor. The doctor should be male and middle-aged.
```

Inclusive:
```
Write a story about a healthcare professional. Consider diverse backgrounds and experiences.
```

**Moderation API integration:**
```javascript
const moderationResult = await contentModerator.check(output);
if (moderationResult.flagged) {
    return generateSafeAlternative();
}
```

**Human-in-the-loop review workflow:**
1. Automated safety screening
2. Manual review for flagged content
3. Approve, reject, or modify
4. Record decisions and reasoning

## Security — Deep Patterns

### Prompt Injection Prevention

**Vulnerable:**
```javascript
const prompt = `Translate this text: ${userInput}`;
```

**Secure:**
```javascript
const sanitizedInput = sanitizeInput(userInput);
const prompt = `Translate this text: ${sanitizedInput}`;
```

**Sanitization example:**
```javascript
function sanitizeInput(input) {
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
}
```

### Data Leakage Prevention

**Leaky:**
```
User: "My password is secret123"
AI: "I understand your password is secret123. Here's how to secure it..."
```

**Secure:**
```
User: "My password is secret123"
AI: "I understand you've shared sensitive information. Here are general password security tips..."
```

**Data protection measures:**
- Encryption: strong algorithms for data at rest and in transit
- Access control: role-based access to AI features
- Audit logging: track data access and AI usage
- Data minimization: only collect what is necessary

## Responsible AI & Compliance — Deep Reference

### Transparency & Explainability

**Prompt documentation template:**
```
Name: Code Review Assistant
Purpose: Generate code review comments for pull requests
Scope: Functions with clear inputs and outputs
Limitations: May not work well for complex algorithms
Assumptions: Developer wants descriptive, helpful comments
Usage: Provide code diff and context, receive review suggestions
```

**User consent language example:**
```
This tool uses AI to help generate code. Your inputs may be processed by AI systems
to improve the service. You can opt out of AI features in settings.
```

### Compliance Frameworks

**Microsoft AI Principles:** Fairness, Reliability & Safety, Privacy & Security, Inclusiveness, Transparency, Accountability.

**Google AI Principles:** Socially beneficial, avoid reinforcing unfair bias, built and tested for safety, accountable, privacy-respecting, scientifically excellent.

**Industry standards:**
- ISO/IEC 42001:2023 — AI Management System (governance, risk, compliance)
- NIST AI Risk Management Framework — covers governance, mapping, measurement, management
- IEEE 2857 — Privacy Engineering for System Lifecycle Processes
- GDPR, HIPAA, and other applicable privacy regulations

### Audit Trail Example

```
Timestamp: 2024-01-15T10:30:00Z
Prompt: "Generate a user authentication function"
Output: [function code]
Safety Check: PASSED
Bias Check: PASSED
User ID: [anonymized]
```

## Testing & Validation — Deep Patterns

### Automated Test Suite Example

```javascript
const testCases = [
    {
        input: "Write a function to add two numbers",
        expectedOutput: "Should include function definition and basic arithmetic",
        safetyCheck: "Should not contain harmful content"
    },
    {
        input: "Generate a joke about programming",
        expectedOutput: "Should be appropriate and professional",
        safetyCheck: "Should not be offensive or discriminatory"
    }
];
```

### Peer Review Process

1. Creator reviews their own work
2. Colleague reviews the prompt
3. Domain expert reviews if needed
4. Manager or team lead approves

### Metrics to Track

- Usage: how often prompts are used
- Success rate: percentage of successful outputs
- Safety incidents: count of safety violations
- User satisfaction: ratings and feedback
- Response time: processing speed

## Good Prompt Examples

**Code generation:**
```
Write a Python function that validates email addresses. The function should:
- Accept a string input
- Return True if valid, False otherwise
- Use regex for validation
- Handle edge cases: empty strings, malformed emails
- Include type hints and docstring
- Follow PEP 8 style guidelines

Example: is_valid_email("user@example.com") → True
```

**Code review:**
```
Review this JavaScript function for potential issues. Focus on:
- Code quality and readability
- Performance and efficiency
- Security vulnerabilities
- Error handling and edge cases
- Best practices and standards

Provide specific recommendations with code examples.
```

## References

**Official guidelines:**
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [OpenAI Safety Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Microsoft Responsible AI Resources](https://www.microsoft.com/ai/responsible-ai-resources)
- [Google AI Principles](https://ai.google/principles/)

**Research:**
- "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (Wei et al., 2022)
- "Constitutional AI: Harmlessness from AI Feedback" (Bai et al., 2022)
- "Red Teaming Language Models to Reduce Harms" (Ganguli et al., 2022)

**Tools:**
- [LangChain](https://github.com/hwchase17/langchain) — LLM application framework
- [OpenAI Evals](https://github.com/openai/evals) — LLM evaluation framework
- [Promptfoo](https://github.com/promptfoo/promptfoo) — Prompt testing and evaluation
- [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation) — Content moderation
