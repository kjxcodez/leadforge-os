export async function callOpenRouter(
  apiKey: string,
  prompt: string,
  model = 'meta-llama/llama-3-8b-instruct:free',
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    signal: options?.signal || null,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
  }

  const json = await response.json() as any;
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter response did not contain message content.');
  }

  return content;
}
