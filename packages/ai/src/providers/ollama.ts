export async function callOllama(
  baseUrl = 'http://localhost:11434',
  prompt: string,
  model = 'llama3',
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    signal: options?.signal || null,
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama Error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as any;
  return json.response || '';
}
