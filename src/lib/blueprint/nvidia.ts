const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type NvidiaChatRequest = {
  apiKey: string;
  messages: NvidiaChatMessage[];
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
};

export const resolveNvidiaApiKey = (requestKey?: string): string | undefined =>
  requestKey || process.env.NVIDIA_API_KEY;

export const getNvidiaKeySource = (requestKey?: string): "request" | "environment" | "missing" => {
  if (requestKey) {
    return "request";
  }

  if (process.env.NVIDIA_API_KEY) {
    return "environment";
  }

  return "missing";
};

export const requestNvidiaChatCompletion = async ({
  apiKey,
  messages,
  model = "meta/llama-3.1-405b-instruct",
  temperature = 0.3,
  topP = 0.7,
  maxTokens = 4096
}: NvidiaChatRequest): Promise<string> => {
  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from NVIDIA API");
  }

  return content as string;
};
