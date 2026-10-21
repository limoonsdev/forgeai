import "server-only";
import { streamAnthropic } from "./anthropic";
import { streamOpenRouter } from "./openrouter";
import { streamMock } from "./mock";
import type { ProviderRequest, ProviderStream } from "./shared";

export function streamModel(req: ProviderRequest): ProviderStream {
  switch (req.model.provider) {
    case "anthropic":
      return streamAnthropic(req);
    case "openrouter":
      return streamOpenRouter(req);
    case "mock":
      return streamMock(req);
  }
}

export { ProviderError } from "./shared";
export type { ProviderRequest } from "./shared";
