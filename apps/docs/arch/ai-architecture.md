# 13. AI Architecture

LeadForge OS leverages LLMs and agents to qualify leads, draft email outreach, and summarize domain pages.

---

## 1. Provider Rationale & Fallbacks

- **OpenRouter Abstraction**: A single API connection providing access to Gemini Flash, Llama, and Claude models. Enables model swap flexibility.
- **Local Inference**: Uses lightweight local models (via Ollama) for offline classification and basic sanitization to preserve absolute data privacy.

---

## 2. Prompt Storage & RAG

1. **Structured YAML Prompts**: Prompts are versioned and stored under `packages/ai/prompts/` as YAML templates, separating prompt text from React code.
2. **Local Vector Database**: Integrates `sqlite-vec` (a lightweight SQLite extension) to store embeddings for RAG contexts and semantic lead searches directly on client machines, avoiding the cost of cloud vector hosts.

```text
       [ User Action ] 
              │
              ▼
    [ AI Orchestrator ] ──► [ Prompts YAML ]
              │
              ▼
    [ Local SQLite-vec ] ──► Query RAG context
              │
              ▼
    [ OpenRouter Client ] ──► Returns qualified lead DTO
```
