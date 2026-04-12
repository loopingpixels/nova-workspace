export class OpenRouterAdapter {
  constructor({ apiKey, baseUrl, referer, appTitle, fetchImpl = globalThis.fetch }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.referer = referer;
    this.appTitle = appTitle;
    this.fetch = fetchImpl;
  }

  async chat({ model, prompt, maxTokens = 400, temperature = 0.2 }) {
    if (!this.apiKey) {
      const error = new Error('OPENROUTER_API_KEY is not configured');
      error.code = 'missing_api_key';
      throw error;
    }

    const started = Date.now();
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.referer,
        'X-Title': this.appTitle,
      },
      body: JSON.stringify({
        model: model.remoteModelId,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: 'You are a model-routing test responder. Be concise.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const latencyMs = Date.now() - started;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data?.error?.message || `OpenRouter HTTP ${response.status}`);
      error.code = data?.error?.code || `http_${response.status}`;
      error.httpStatus = response.status;
      error.retryable = [408, 409, 429, 500, 502, 503, 504].includes(response.status);
      error.latencyMs = latencyMs;
      throw error;
    }

    const content = data?.choices?.[0]?.message?.content || '';
    return {
      text: content,
      latencyMs,
      providerResponse: data,
    };
  }
}
