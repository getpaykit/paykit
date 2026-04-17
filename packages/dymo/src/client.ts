import { dymoResponseSchema, type DymoConfig, type DymoResponse } from "./schema";

export const createDymoClient = (config: DymoConfig) => {
  const baseUrl = "https://api.dymo.ai/v1";

  /**
   * Private request handler
   */
  const request = async (
    endpoint: string,
    data: Record<string, unknown>,
  ): Promise<DymoResponse> => {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          // Pass the user's custom deny rules directly to the API
          rules: config.rules,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Dymo API Error: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      return dymoResponseSchema.parse(payload);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
    isValidEmail: (email: string) => request("/validate/email", { email }),
    isValidIP: (ip: string) => request("/validate/ip", { ip }),
  };
};
