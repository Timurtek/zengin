import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { pickReply } from "./script";

/**
 * A ChatTransport that streams scripted replies with the timing of a real model: thinking first, a tool
 * call that takes a moment, then the answer token by token, then sources. It emits the same UIMessageChunk
 * events a server would, so `useChat` treats it exactly like a real endpoint. Swap it for
 * `new DefaultChatTransport({ api: "/api/chat" })` to talk to a model.
 */
export class ScriptedTransport implements ChatTransport<UIMessage> {
  constructor(private readonly speed = 1) {}

  async sendMessages({ messages, abortSignal }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const userText = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";
    const reply = pickReply(userText);
    const speed = this.speed;
    const id = `${Date.now().toString(36)}`;

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        const emit = (chunk: UIMessageChunk): void => controller.enqueue(chunk);
        const wait = (ms: number): Promise<void> =>
          new Promise((resolve, reject) => {
            const t = setTimeout(resolve, ms / speed);
            abortSignal?.addEventListener("abort", () => {
              clearTimeout(t);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        try {
          emit({ type: "start" });
          emit({ type: "start-step" });

          emit({ type: "reasoning-start", id: `${id}-r` });
          for (const word of tokens(reply.reasoning)) {
            emit({ type: "reasoning-delta", id: `${id}-r`, delta: word });
            await wait(14);
          }
          emit({ type: "reasoning-end", id: `${id}-r` });

          if (reply.tool) {
            const toolCallId = `${id}-t`;
            emit({ type: "tool-input-start", toolCallId, toolName: reply.tool.name });
            await wait(250);
            emit({ type: "tool-input-available", toolCallId, toolName: reply.tool.name, input: reply.tool.input });
            await wait(700);
            emit({ type: "tool-output-available", toolCallId, output: reply.tool.output });
            await wait(200);
          }

          emit({ type: "text-start", id: `${id}-x` });
          for (const word of tokens(reply.text)) {
            emit({ type: "text-delta", id: `${id}-x`, delta: word });
            await wait(18);
          }
          emit({ type: "text-end", id: `${id}-x` });

          for (const [i, s] of (reply.sources ?? []).entries()) emit({ type: "source-url", sourceId: `${id}-s${i}`, url: s.url, title: s.title });

          emit({ type: "finish-step" });
          emit({ type: "finish" });
          controller.close();
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            emit({ type: "abort" });
            controller.close();
          } else {
            controller.error(e);
          }
        }
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

/** Words with their trailing whitespace, so the stream reads like tokens. */
function tokens(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}
