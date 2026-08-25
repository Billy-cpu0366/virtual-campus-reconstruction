import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const EXTENSION_VERSION = "1.1.0";

type Entry = {
  id?: string;
  type?: string;
  message?: { role?: string; content?: unknown; stopReason?: string };
};

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type?: string; text?: unknown } =>
      typeof part === "object" && part !== null,
    )
    .filter((part) =>
      part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
}

function hasToolCall(content: unknown): boolean {
  return Array.isArray(content) && content.some((part) =>
    typeof part === "object" && part !== null &&
    (part as { type?: string }).type === "toolCall",
  );
}

export default function (pi: ExtensionAPI) {
  const recovered = new Set<string>();

  pi.registerCommand("empty-final-recovery-status", {
    description: "Confirm that the empty-final recovery guard is loaded",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `Empty-final recovery guard v${EXTENSION_VERSION} is loaded.`,
        "info",
      );
    },
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const branch = ctx.sessionManager.getBranch() as Entry[];
    const last = branch.at(-1);
    const message = last?.type === "message" ? last.message : undefined;
    if (
      message?.role !== "assistant" ||
      message.stopReason !== "stop" ||
      hasToolCall(message.content) ||
      textOf(message.content).trim() !== ""
    ) return;

    const key = last?.id ?? "unidentified-empty-final";
    if (recovered.has(key)) return;
    recovered.add(key);

    ctx.ui.notify("Recovered an empty terminal model response.", "warning");
    pi.sendMessage({
      customType: "empty-final-recovery",
      display: true,
      details: { recoveredEntryId: key },
      content: [{
        type: "text",
        text: "Recovery guard: previous turn ended with an empty final response. Continue from the last successful tool result. Do not stop without completion, a Human decision, or an evidenced blocker.",
      }],
    }, { triggerTurn: true, deliverAs: "followUp" });
  });
}
