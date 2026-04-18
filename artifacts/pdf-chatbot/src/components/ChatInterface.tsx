import { useState, useRef, useEffect } from "react";
import { useChatWithPdf, useGetPdfStatus } from "@workspace/api-client-react";
import { Send, User, Bot, Loader2, Globe, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type WebResult = {
  title: string;
  url: string;
  content: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  webResults?: WebResult[];
  usedWebSearch?: boolean;
  usedPdf?: boolean;
};

export function ChatInterface() {
  const { data: status } = useGetPdfStatus();
  const chatMutation = useChatWithPdf();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPdfRequired = !status?.indexed && !webSearch;
    if (!input.trim() || chatMutation.isPending || isPdfRequired) return;

    const userMsg = input.trim();
    setInput("");

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMsg }
    ];
    setMessages(newMessages);

    try {
      const response = await chatMutation.mutateAsync({
        data: {
          question: userMsg,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          webSearch,
        }
      });

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          webResults: (response as any).webResults ?? [],
          usedWebSearch: webSearch,
          usedPdf: !!status?.indexed,
        }
      ]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "죄송해요, 답변을 생성하는 중 오류가 발생했습니다." }
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canChat = status?.indexed || webSearch;

  if (!canChat && messages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-card z-10">
          <SearchToggle webSearch={webSearch} setWebSearch={setWebSearch} />
        </div>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
          <Bot className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">준비 중</h3>
          <p className="max-w-sm text-sm">
            여행기 PDF를 업로드하거나, 인터넷 검색을 켜면 질문할 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-card z-10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold">여행 어시스턴트</h2>
          <p className="text-xs text-muted-foreground">
            {status?.indexed
              ? `📖 ${status.filename || "여행기"}`
              : "PDF 없음"}
            {webSearch ? " · 🌐 인터넷 검색 켜짐" : ""}
          </p>
        </div>
        <SearchToggle webSearch={webSearch} setWebSearch={setWebSearch} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="bg-primary/5 p-4 rounded-full">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-center max-w-xs">
              동유럽 여행에 대해 뭐든 물어보세요!<br />
              여행기 내용과 최신 정보를 함께 알려드릴게요.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["프라하 추천 명소는?", "부다페스트 음식 뭐가 맛있어?", "비엔나 교통 어떻게 해?"].map(q => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : "order-2"}`}>
                <div className={`p-4 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                </div>

                {msg.role === "assistant" && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {msg.usedPdf && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <BookOpen className="h-3 w-3" /> 여행기 참고
                      </Badge>
                    )}
                    {msg.usedWebSearch && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Globe className="h-3 w-3" /> 인터넷 검색
                      </Badge>
                    )}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-muted-foreground cursor-pointer ml-1 hover:text-foreground">
                      📖 여행기 출처 ({msg.sources.length}개)
                    </summary>
                    <div className="mt-1 space-y-1">
                      {msg.sources.map((source, sIdx) => (
                        <div key={sIdx} className="text-xs bg-secondary/50 p-2 rounded border text-muted-foreground line-clamp-3">
                          "{source.trim()}"
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {msg.webResults && msg.webResults.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-muted-foreground cursor-pointer ml-1 hover:text-foreground">
                      🌐 웹 검색 결과 ({msg.webResults.length}개)
                    </summary>
                    <div className="mt-1 space-y-2">
                      {msg.webResults.map((r, rIdx) => (
                        <a
                          key={rIdx}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-300 mb-1">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="line-clamp-1">{r.title}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-2">{r.content}</p>
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 order-2">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))
        )}

        {chatMutation.isPending && (
          <div className="flex gap-4 justify-start">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="bg-muted text-foreground p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">
                {webSearch ? "웹 검색 중..." : "답변 생성 중..."}
              </span>
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-card border-t mt-auto">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canChat ? "여행에 대해 무엇이든 물어보세요..." : "PDF를 업로드하거나 인터넷 검색을 켜주세요"}
            className="pr-12 min-h-[52px] max-h-[200px] py-3 resize-none rounded-xl bg-muted/50 border-transparent focus-visible:bg-background"
            rows={1}
            disabled={chatMutation.isPending || !canChat}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-transform hover:scale-105"
            disabled={!input.trim() || chatMutation.isPending || !canChat}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">전송</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

function SearchToggle({
  webSearch,
  setWebSearch,
}: {
  webSearch: boolean;
  setWebSearch: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <Globe className={`h-4 w-4 ${webSearch ? "text-blue-500" : "text-muted-foreground"}`} />
      <span className="text-sm">인터넷 검색</span>
      <button
        type="button"
        role="switch"
        aria-checked={webSearch}
        onClick={() => setWebSearch(!webSearch)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          webSearch ? "bg-blue-500" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
            webSearch ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
