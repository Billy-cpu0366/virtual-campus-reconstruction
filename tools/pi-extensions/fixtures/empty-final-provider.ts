import {
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "empty-final-fixture";
const MODEL_ID = "empty-final-fixture-model";

let requestCount = 0;

function usage() {
  return {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function streamFixture(
  model: Model<any>,
  _context: Context,
  _options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  requestCount += 1;

  queueMicrotask(() => {
    const mode = process.env.EMPTY_FINAL_FIXTURE_MODE ?? "empty-then-recover";
    const text = mode === "normal"
      ? "NORMAL"
      : requestCount === 1
        ? ""
        : "RECOVERED";
    const output: AssistantMessage = {
      role: "assistant",
      content: text === "" ? [] : [{ type: "text", text }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: usage(),
      stopReason: "stop",
      timestamp: Date.now(),
    };

    stream.push({ type: "start", partial: output });
    if (text !== "") {
      stream.push({ type: "text_start", contentIndex: 0, partial: output });
      stream.push({
        type: "text_delta",
        contentIndex: 0,
        delta: text,
        partial: output,
      });
      stream.push({
        type: "text_end",
        contentIndex: 0,
        content: text,
        partial: output,
      });
    }
    stream.push({ type: "done", reason: "stop", message: output });
    stream.end();
  });

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(PROVIDER_ID, {
    name: "Empty Final Test Fixture",
    baseUrl: "http://127.0.0.1/unused",
    apiKey: "fixture-key",
    api: "openai-completions",
    models: [{
      id: MODEL_ID,
      name: "Empty Final Test Fixture Model",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 8_192,
      maxTokens: 128,
    }],
    streamSimple: streamFixture,
  });
}
