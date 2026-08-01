# Provider Capabilities Model

This specification defines the `ProviderCapabilities` structure. It enables LeadForge to intelligently route LLM calls across diverse providers (Ollama, OpenRouter, OpenAI, Gemini, Anthropic) based on model features rather than hardcoded logic.

---

## Capabilities Schema

```typescript
export interface ProviderCapabilities {
  readonly supportsVision: boolean;            # Can process image inputs
  readonly supportsImages: boolean;            # Can generate image outputs
  readonly supportsAudio: boolean;             # Can process/generate speech
  readonly supportsEmbeddings: boolean;        # Native support for vector representations
  readonly supportsStreaming: boolean;         # Supports token-by-token response streams
  readonly supportsTools: boolean;             # Supports API tool definitions
  readonly supportsStructuredOutputs: boolean; # Enforces strict JSON schemas (Zod)
  readonly supportsThinking: boolean;          # Exposes hidden chain-of-thought blocks
  readonly supportsReasoning: boolean;         # Native reasoning reasoning paths (e.g. OpenAI o1/o3)
  readonly supportsContextCaching: boolean;    # Reduces prompt compilation pricing
  readonly supportsLargeContext: boolean;      # Supports >128k token context windows
  readonly supportsJSON: boolean;              # Can restrict output format to JSON mode
  readonly supportsFunctionCalling: boolean;   # Native model function selection triggers
  readonly supportsMCP: boolean;               # Supports Model Context Protocol triggers
}
```

---

## Provider Comparison Reference

The capabilities are resolved dynamically by the AI Runtime at startup:

| Capability                      | Ollama (Local Llama 3) | OpenRouter (Cloud Core) | Anthropic (Claude 3.5 Sonnet) | OpenAI (GPT-4o) |
| :------------------------------ | :--------------------: | :---------------------: | :---------------------------: | :-------------: |
| **`supportsVision`**            |           ✅           |           ✅            |              ✅               |       ✅        |
| **`supportsEmbeddings`**        |           ✅           |           ❌            |              ❌               |       ✅        |
| **`supportsStreaming`**         |           ✅           |           ✅            |              ✅               |       ✅        |
| **`supportsTools`**             |           ✅           |           ✅            |              ✅               |       ✅        |
| **`supportsStructuredOutputs`** |           ❌           |           ✅            |              ✅               |       ✅        |
| **`supportsThinking`**          |           ❌           |           ✅            |              ✅               |       ❌        |
| **`supportsContextCaching`**    |           ❌           |           ❌            |              ✅               |       ✅        |

---

## Architectural Usage

1. **Intelligent Fallbacks**: If an agent requests structured lead extraction requiring `supportsStructuredOutputs`, and OpenRouter is offline, the AI Runtime verifies Llama3 capabilities. Since Ollama Llama 3 does not natively support structured schema enforcement, the Runtime dynamically wraps the local prompt with secondary parser guardrails.
2. **Cost & Latency Routing**: Single-step summarizations are routed to local models (`Ollama`) if they do not require cloud reasoning tools.
