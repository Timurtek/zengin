import { useChat } from "@ai-sdk/react";
import { Avatar, Button, Conversation, Loader, Markdown, Message, PromptInput, Reasoning, Select, Sources, Suggestions, Toast, ToolCall, Tooltip, toast } from "@zenginui/ui";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { THREADS } from "./data";
import { SUGGESTIONS } from "./script";
import { ScriptedTransport } from "./transport";

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into portals (menus, toasts) as well as the page. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [model, setModel] = useState("fable");
  const transport = useMemo(() => new ScriptedTransport(), []);
  const { messages, sendMessage, status, stop, regenerate, setMessages } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => void sendMessage({ text });

  return (
    <Tooltip.Provider>
      <Toast.Provider position="top-right">
        <div className="chat">
          <aside className="chat__side" aria-label="Conversations">
            <div className="chat__brand">
              <Avatar name="Zengin" shape="square" size="md" />
              <strong>Assistant</strong>
            </div>
            <Button tone="primary" size="sm" className="chat__new" onClick={() => setMessages([])}>
              New chat
            </Button>
            <nav className="chat__threads" aria-label="Recent">
              {THREADS.map((t, i) => (
                <Button key={t.id} variant={i === 0 ? "soft" : "ghost"} size="sm" align="start" className="chat__thread" aria-current={i === 0 ? "page" : undefined}>
                  {t.title}
                </Button>
              ))}
            </nav>
            <p className="chat__foot">Scripted transport. Swap it for a route to talk to a model.</p>
          </aside>

          <main className="chat__main">
            <header className="chat__head">
              <h1 className="chat__title">Rules and fixes</h1>
              <div className="chat__tools">
                <Select size="sm" value={model} onValueChange={setModel} aria-label="Model" className="chat__model">
                  <Select.Item value="fable">Fable 5.1</Select.Item>
                  <Select.Item value="opus">Opus 5</Select.Item>
                  <Select.Item value="sonnet">Sonnet 5</Select.Item>
                  <Select.Item value="haiku">Haiku 4.5</Select.Item>
                </Select>
                <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
                  <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
                    {theme === "light" ? "Dark" : "Light"}
                  </Button>
                </Tooltip>
              </div>
            </header>

            <Conversation className="chat__thread-view">
              <Conversation.Content className="chat__log">
                {messages.length === 0 && (
                  <div className="chat__empty">
                    <h2>What can I help with?</h2>
                    <p>Ask about the rules, check a file, or set up a theme. The answers are scripted, the streaming is real.</p>
                    <Suggestions items={SUGGESTIONS} onSelect={send} />
                  </div>
                )}
                {messages.map((m) => (
                  <Turn key={m.id} message={m} streaming={busy && m === messages[messages.length - 1]} onRegenerate={() => void regenerate()} />
                ))}
                {status === "submitted" && (
                  <Message role="assistant">
                    <Message.Content>
                      <Loader />
                    </Message.Content>
                  </Message>
                )}
              </Conversation.Content>
              <Conversation.ScrollButton />
            </Conversation>

            <div className="chat__composer">
              <PromptInput
                onSubmit={send}
                status={status}
                onStop={() => void stop()}
                placeholder="Ask about the system"
                toolbar={
                  <Button variant="ghost" size="sm" onClick={() => toast({ title: "Attachments are not in the script", description: "A real transport would upload the file." })}>
                    Attach
                  </Button>
                }
              />
              <p className="chat__hint">Enter to send, Shift+Enter for a new line.</p>
            </div>
          </main>
        </div>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}

/** One message, rendered part by part in the order the model produced them. */
function Turn({ message, streaming, onRegenerate }: { message: UIMessage; streaming: boolean; onRegenerate: () => void }) {
  const sources = message.parts.filter((p) => p.type === "source-url").map((p) => ({ url: p.url, title: p.title }));
  const text = message.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n\n");
  return (
    <Message role={message.role === "user" ? "user" : "assistant"} name={message.role === "user" ? "You" : "Assistant"}>
      <Message.Content>
        {message.parts.map((part, i) => {
          if (part.type === "reasoning") return <Reasoning key={i} text={part.text} streaming={streaming && part.state === "streaming"} />;
          if (part.type === "text") return <Markdown key={i} text={part.text} streaming={streaming && part.state === "streaming"} />;
          if (part.type === "dynamic-tool") return <ToolCall key={i} name={part.toolName} state={part.state} input={part.input} output={part.output} errorText={part.errorText} />;
          if (part.type.startsWith("tool-")) {
            const tool = part as Extract<UIMessage["parts"][number], { toolCallId: string }>;
            return <ToolCall key={i} name={part.type.slice(5)} state={tool.state} input={tool.input} output={tool.output} errorText={"errorText" in tool ? tool.errorText : undefined} />;
          }
          return null;
        })}
        {sources.length > 0 && !streaming && <Sources sources={sources} />}
      </Message.Content>
      {message.role === "assistant" && !streaming && (
        <Message.Actions>
          <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(text).then(() => toast({ title: "Copied" }))}>
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={onRegenerate}>
            Regenerate
          </Button>
        </Message.Actions>
      )}
    </Message>
  );
}
