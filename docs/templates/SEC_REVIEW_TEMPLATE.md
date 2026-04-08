# Security Review

> **Title**: {feature or change being reviewed}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Reviewer**: {security reviewer name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | In Review | Approved | Blocked
> **Risk Level**: Low | Medium | High | Critical

---

## 1. Change Summary

{What is being added/changed that has security implications?}

## 2. Threat Model

### Risk Scoring Matrix

> All threat scenarios below use this scoring matrix. Risk Score = Likelihood x Impact.

| Score | Likelihood Definition | Impact Definition |
|-------|----------------------|-------------------|
| 1 | Rare — requires insider + multiple failures | Negligible — no data exposure, cosmetic only |
| 2 | Unlikely — requires specific conditions | Minor — limited data exposure, easily contained |
| 3 | Possible — known attack pattern exists | Moderate — partial data breach, service degradation |
| 4 | Likely — low-skill attack, exposed surface | Major — significant data breach, extended outage |
| 5 | Almost certain — actively exploited in the wild | Critical — full data exfiltration, regulatory violation, total loss of trust |

| Risk Score | Level | Response |
|------------|-------|----------|
| 1-5 | Low | Accept or mitigate in next sprint |
| 6-12 | Medium | Mitigate before release |
| 13-19 | High | Mitigate before merge |
| 20-25 | Critical | Stop — immediate remediation required |

### Assets at Risk

| Asset | Sensitivity | Impact if Compromised |
|-------|------------|----------------------|
| {e.g., Contract data} | High (PII, confidential) | {Data breach, legal liability} |
| {e.g., Anthropic API key} | Critical | {Cost abuse, data exfiltration via prompts} |
| {e.g., Tenant isolation} | Critical | {Cross-tenant data leak} |

### Attack Surface Changes

| Surface | Before | After | Risk Change |
|---------|--------|-------|-------------|
| {e.g., API endpoints} | {14 endpoints} | {16 endpoints (+agents/invoke, agents/stream)} | {Increased — new input vectors} |
| {e.g., External API calls} | {OpenAI only} | {OpenAI + Anthropic + Google} | {Increased — more credential management} |

### Threat Scenarios

#### T1: {Threat name, e.g., "Prompt injection via contract text"}

| Attribute | Value |
|-----------|-------|
| **Attack vector** | {How the attack works} |
| **Likelihood** | {1-5} |
| **Impact** | {1-5} |
| **Risk Score** | {L x I} |

**Mitigations**:
- {Mitigation 1: e.g., "Input sanitization before agent prompt"}
- {Mitigation 2: e.g., "Tool calls are tenant-scoped, cannot access other tenants"}

**Residual risk**: {What risk remains after mitigations}

#### T2: {Next threat}

{Same structure}

## 3. AI / LLM Security

> Dedicated section for AI-specific attack vectors. Mark `N/A` if this change does not involve AI/LLM components.

| Threat Category | Attack Description | Mitigation | Status |
|----------------|-------------------|------------|--------|
| **Direct prompt injection** | {e.g., User crafts input to override system prompt} | {e.g., System prompt isolation; input/output boundary markers} | {Mitigated / Partial / Open} |
| **Indirect prompt injection** | {e.g., Malicious content in uploaded contract instructs agent to exfiltrate data} | {e.g., Tool calls are tenant-scoped; output validated against source} | {status} |
| **Jailbreak resistance** | {e.g., Prompt designed to make agent ignore safety constraints} | {e.g., Output classifier; blocked response patterns} | {status} |
| **Output validation** | {e.g., Agent generates fabricated legal citations} | {e.g., All citations verified against source document; hallucination detection} | {status} |
| **Data exfiltration via model** | {e.g., Prompt designed to include sensitive data in tool calls to external services} | {e.g., All tool calls are internal; no external HTTP from agent context} | {status} |
| **Model abuse / cost attack** | {e.g., Attacker sends large volume of expensive agent calls} | {e.g., Rate limiting per tenant; cost cap alerts; max token budget per invocation} | {status} |
| **Training data leakage** | {e.g., Model reveals training data from other tenants} | {e.g., No fine-tuning on customer data; vendor-hosted models only} | {status} |

## 4. Authentication & Authorization

| Endpoint / Feature | Auth Method | Authorization Check | Multi-Tenant Isolation |
|--------------------|------------|--------------------|-----------------------|
| {e.g., POST /agents/invoke} | {Bearer JWT} | {Role: contract_analyst+} | {Tenant ID from token, injected into all tool calls} |

## 5. Data Handling

### Data in Transit

| Data Flow | Protocol | Encryption |
|-----------|----------|------------|
| {Client → Backend} | {HTTPS} | {TLS 1.3} |
| {Backend → Anthropic API} | {HTTPS} | {TLS 1.3} |

### Data at Rest

| Data Store | Encryption | Key Management |
|------------|-----------|----------------|
| {PostgreSQL} | {AES-256} | {env var / KMS} |
| {Redis (agent state)} | {None — ephemeral} | {N/A, TTL enforced} |

### PII Handling

| Data Element | PII? | Handling |
|-------------|------|---------|
| {Contract party names} | Yes | {Stored encrypted, not logged} |
| {Agent conversation history} | Maybe | {TTL in Redis, purged after 24h} |
| {Document images sent to VLM} | Yes | {Sent to Anthropic API — review DPA} |

## 6. Data Retention & Deletion

| Data Type | Retention Period | Deletion Method | Right-to-Delete | DPA Reference |
|-----------|-----------------|----------------|-----------------|---------------|
| {Contract data} | {Per customer contract, default 7 years} | {Soft delete → hard delete after 90 days} | {Yes — tenant data purge API} | {link to DPA} |
| {Agent conversation logs} | {24 hours} | {TTL expiry in Redis} | {Automatic} | N/A |
| {Embeddings} | {Same as source document} | {Cascade delete from Qdrant on doc deletion} | {Yes — included in tenant purge} | N/A |
| {Audit logs} | {7 years (regulatory minimum)} | {Immutable; archived to cold storage after 1 year} | {Excluded per legal requirement} | {link} |

## 7. Third-Party Data Flows

> What data leaves your infrastructure and goes to external vendors? Each flow needs a DPA and risk assessment.

| Vendor | Data Sent | Purpose | DPA in Place? | Data Residency | Retention by Vendor |
|--------|-----------|---------|---------------|----------------|---------------------|
| {e.g., Anthropic} | {e.g., Contract text, system prompts} | {e.g., LLM inference} | {Yes — [link]({URL})} | {e.g., US} | {e.g., Zero retention (API terms)} |
| {e.g., OpenAI} | {e.g., Text chunks for embedding} | {e.g., Embedding generation} | {Yes — [link]({URL})} | {e.g., US} | {e.g., 30-day abuse monitoring, then deleted} |
| {e.g., Sentry} | {e.g., Stack traces, request metadata} | {e.g., Error tracking} | {Yes — [link]({URL})} | {e.g., EU} | {e.g., 90 days} |

**Risk**: {e.g., "Contract text sent to Anthropic may contain PII. Mitigated by: DPA prohibits training on customer data; no PII logged in prompts; sensitive fields redacted before sending."}

## 8. Compliance Mapping

| Control | Framework | Requirement | Status | Evidence |
|---------|-----------|-------------|--------|----------|
| {e.g., Encryption at rest} | SOC 2 (CC6.1) | {All sensitive data encrypted with AES-256} | {Compliant / Gap / N/A} | {e.g., AWS RDS encryption config screenshot; KMS key policy} |
| {e.g., Access logging} | SOC 2 (CC7.2) | {All PII access logged with user identity} | {status} | {e.g., Audit log query showing user identity in all entries} |
| {e.g., Right to erasure} | GDPR (Art. 17) | {Data subjects can request deletion} | {status} | {e.g., Tenant purge API test results; cascade verification} |
| {e.g., Data minimization} | GDPR (Art. 5) | {Only collect necessary data} | {status} | {e.g., Data inventory spreadsheet showing justification per field} |
| {e.g., Consumer opt-out} | CCPA (1798.120) | {Consumers can opt out of data sale/sharing} | {status} | {e.g., Opt-out UI flow screenshot; backend confirmation} |

## 9. Dependency Security

| New Dependency | License | Known CVEs | Maintainer Status |
|----------------|---------|-----------|-------------------|
| {claude-agent-sdk} | {MIT} | {None} | {Active — Anthropic} |
| {google-generativeai} | {Apache 2.0} | {None} | {Active — Google} |

## 10. Secrets Management

| Secret | Storage | Rotation Policy | Access Scope |
|--------|---------|----------------|-------------|
| {ANTHROPIC_API_KEY} | {.env / vault} | {90 days} | {Backend only} |
| {JWT_SECRET_KEY} | {.env / vault} | {90 days} | {Backend only} |

## 11. Security Scanning Results

| Scan Type | Tool | Date Run | Critical | High | Medium | Low | Report |
|-----------|------|----------|----------|------|--------|-----|--------|
| SAST | {e.g., Semgrep / Bandit} | {YYYY-MM-DD} | {0} | {0} | {2} | {5} | [{link}]({URL}) |
| DAST | {e.g., OWASP ZAP} | {YYYY-MM-DD} | {0} | {1} | {0} | {3} | [{link}]({URL}) |
| Dependency | {e.g., pip-audit / Snyk} | {YYYY-MM-DD} | {0} | {0} | {1} | {0} | [{link}]({URL}) |
| Container | {e.g., Trivy / Grype} | {YYYY-MM-DD} | {0} | {0} | {0} | {2} | [{link}]({URL}) |
| Secret scan | {e.g., trufflehog / gitleaks} | {YYYY-MM-DD} | {0} | {0} | {0} | {0} | [{link}]({URL}) |

## 12. Penetration Testing

> **Required for High/Critical risk levels.** For Low/Medium, mark `N/A — risk level does not require pen test`.

| Aspect | Detail |
|--------|--------|
| Required? | {Yes — risk level is {High/Critical} / No — risk level is {Low/Medium}} |
| Scope | {e.g., New agent invocation endpoints, tool call authorization boundary} |
| Type | {e.g., Black box / Grey box / White box} |
| Performed by | {e.g., Internal security team / External vendor: {name}} |
| Date | {YYYY-MM-DD or "Scheduled for YYYY-MM-DD"} |
| Report | [{link}]({URL}) or "Pending" |
| Critical findings | {count — must be 0 before approval} |

## 13. Incident Response

> What happens when a vulnerability in this feature is exploited?

| Aspect | Detail |
|--------|--------|
| IR playbook | {Link to standing incident response playbook, or "Use general IR process at {link}"} |
| Detection | {e.g., "WAF alerts on injection patterns; anomaly detection on agent cost spikes"} |
| Containment | {e.g., "Kill switch: disable agent endpoints via feature flag `AGENTS_ENABLED=false`"} |
| Notification | {e.g., "Security team Slack channel; affected tenants within 72 hours per GDPR"} |
| Evidence preservation | {e.g., "Audit logs are immutable and retained 7 years; agent conversation logs preserved (override 24h TTL)"} |

## 14. Findings & Recommendations

| ID | Finding | Severity | Risk Score | Recommendation | Status |
|----|---------|----------|------------|---------------|--------|
| F1 | {finding} | {Critical/High/Medium/Low} | {L x I} | {recommendation} | {Open/Resolved} |
| F2 | {finding} | {severity} | {score} | {recommendation} | {status} |

## 15. Approval

| Role | Name | Decision | Date | Notes |
|------|------|----------|------|-------|
| {Security Reviewer} | | {Approved/Blocked} | | |
| {Tech Lead} | | {Acknowledged} | | |

## 16. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Dep Review | [Dep Review](../phase-{X}/{X.X}_dep-review_{name}.md) |
| Data Processing Agreement | [{Vendor DPA}]({link}) |
| {Other} | [{Title}]({relative path}) |

## 17. References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP LLM Top 10: https://genai.owasp.org/llm-top-10/
- {Link to data processing agreement with Anthropic}

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial review | {name} |
| {YYYY-MM-DD} | {e.g., Updated threat model after pen test} | {name} |
| {YYYY-MM-DD} | {e.g., Approved} | {name} |
