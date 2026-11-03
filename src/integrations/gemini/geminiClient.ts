const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

type GeminiResponse = {
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

export async function requestGeminiAdvice(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ model: 'gemini-3.5-flash-lite', input: prompt, store: false }),
  });
  const body = await response.json() as GeminiResponse;
  if (!response.ok) throw new Error(body.error?.message || 'Gemini could not answer. Check the API key and try again.');
  return (body.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}
