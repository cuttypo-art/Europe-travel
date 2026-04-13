import { PdfUploader } from "@/components/PdfUploader";
import { ChatInterface } from "@/components/ChatInterface";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <header className="border-b bg-card px-6 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
          D
        </div>
        <h1 className="text-xl font-bold tracking-tight">DocAssist</h1>
      </header>

      <main className="flex-1 p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
        <section className="w-full md:w-1/3 flex flex-col gap-4">
          <div className="h-full max-h-[300px] md:max-h-none">
            <PdfUploader />
          </div>
        </section>
        
        <section className="w-full md:w-2/3 flex flex-col h-[600px] md:h-auto md:min-h-[calc(100vh-8rem)]">
          <ChatInterface />
        </section>
      </main>
    </div>
  );
}
