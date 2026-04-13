import { useState, useRef, useEffect } from "react";
import { useChatWithPdf, useGetPdfStatus } from "@workspace/api-client-react";
import { Send, User, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export function ChatInterface() {
  const { data: status } = useGetPdfStatus();
  const chatMutation = useChatWithPdf();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !status?.indexed || chatMutation.isPending) return;

    const userMsg = input.trim();
    setInput("");
    
    // Add user message to history
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMsg }
    ];
    setMessages(newMessages);

    try {
      const response = await chatMutation.mutateAsync({
        data: {
          question: userMsg,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: response.answer, sources: response.sources }
      ]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "I encountered an error trying to process your request." }
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!status?.indexed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground bg-card/50 rounded-xl border border-dashed shadow-sm">
        <Bot className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Document Indexed</h3>
        <p className="max-w-sm">
          Please upload a PDF document first. Once it's processed, you can start asking questions about its contents here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-card z-10 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Assistant</h2>
          <p className="text-xs text-muted-foreground">Ask anything about {status.filename || 'the document'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="bg-primary/5 p-4 rounded-full">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <p>I'm ready! Ask me a question about the document.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-muted text-foreground rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                </div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground ml-1">Sources</p>
                    {msg.sources.map((source, sIdx) => (
                      <div key={sIdx} className="text-xs bg-secondary/50 p-2 rounded border text-muted-foreground line-clamp-3">
                        "{source.trim()}"
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
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
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
            placeholder="Ask a question..."
            className="pr-12 min-h-[52px] max-h-[200px] py-3 resize-none rounded-xl bg-muted/50 border-transparent focus-visible:bg-background"
            rows={1}
            disabled={chatMutation.isPending || !status?.indexed}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-transform hover:scale-105"
            disabled={!input.trim() || chatMutation.isPending || !status?.indexed}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
