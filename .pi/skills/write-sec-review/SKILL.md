---
name: write-sec-review
description: Guide through creating a Security Review with threat modeling, risk scoring, AI/LLM security analysis, compliance mapping, and incident response planning
---

# Write a Security Review

You are helping the user create a Security Review. The Security Review answers: **"What are the security implications?"** Required before merging security-sensitive PRs.

## Before You Start

1. Read the template: `docs/templates/SEC_REVIEW_TEMPLATE.md`
2. Check for the upstream Tech Spec — understand what's being built
3. Check the ID Spec if APIs are involved — understand the attack surface
4. Determine risk level: Low | Medium | High | Critical

## Authorship

- **Primary author**: Security Engineer (or Tech Lead for Low/Medium risk)
- **Co-contributors**: Tech Lead, feature engineer
- **Approvers**: Security Reviewer + Tech Lead
- **Consumers**: Engineers (remediation), Compliance team, Legal, Auditors

## Naming

```
docs/phase-{N}/{N.X}_sec-review_{feature-name}.md
```

## Workflow

### 1. Change Summary
What is being added/changed that has security implications?

### 2. Threat Model
Use the Risk Scoring Matrix: Likelihood (1-5) x Impact (1-5).
- **Assets at Risk**: What data/systems could be compromised?
- **Attack Surface Changes**: What's new? (endpoints, external calls, data flows)
- **Threat Scenarios**: For each, define: attack vector, likelihood, impact, risk score, mitigations, residual risk

### 3. AI / LLM Security (CRITICAL for this project)
Cover OWASP LLM Top 10 systematically:
- Direct prompt injection
- Indirect prompt injection (malicious content in uploaded contracts)
- Jailbreak resistance
- Output validation (fabricated legal citations)
- Data exfiltration via model
- Model abuse / cost attacks
- Training data leakage

### 4-8. Auth, Data Handling, Retention, Third-Party Flows
For each: specify mechanism, encryption, PII handling, DPA status.

### 9. Compliance Mapping
Map to specific framework controls: SOC 2 (CC numbers), GDPR (Article numbers), CCPA sections.

### 10-13. Dependency Security, Secrets, Scanning, Pen Testing
Complete all sections. Pen testing required for High/Critical risk.

### 14. Findings
Every finding needs: ID, severity, risk score (L x I), specific recommendation, status.

## Quality Checklist

- [ ] Risk scoring uses the Likelihood x Impact matrix consistently
- [ ] AI/LLM section covers all 7 threat categories
- [ ] Every finding has a risk score AND specific mitigation
- [ ] Third-party data flows list every vendor that receives data
- [ ] Compliance mapping references specific control IDs
- [ ] Pen testing is scheduled for High/Critical risk
- [ ] Incident response includes feature-specific detection and containment
- [ ] All security scan tools have been run with results recorded
