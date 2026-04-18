import { useState, useRef } from "react";
import { useUploadPdf, useGetPdfStatus } from "@workspace/api-client-react";
import { UploadCloud, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function PdfUploader() {
  const { data: status, refetch: refetchStatus } = useGetPdfStatus();
  const uploadPdf = useUploadPdf();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "PDF 파일만 업로드 가능해요",
        description: "PDF 형식의 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadPdf.mutateAsync({ data: { file } });
      toast({
        title: "여행기 업로드 완료!",
        description: "이제 여행기 내용에 대해 질문할 수 있어요.",
      });
      refetchStatus();
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: "파일 업로드 중 오류가 발생했어요. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const isUploading = uploadPdf.isPending;

  if (status?.indexed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-card rounded-xl border shadow-sm">
        <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold mb-1">여행기 준비 완료!</h3>
        <p className="text-sm text-muted-foreground mb-2">
          📖 {status.filename || "여행기"}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          {status.chunkCount}개 섹션으로 인덱싱됨
        </p>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          다른 PDF 업로드
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center h-full p-8 text-center border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
        isDragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />

      {isUploading ? (
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold">여행기 분석 중...</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            텍스트를 추출하고 임베딩을 생성하고 있어요. 잠시만 기다려주세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">여행기 PDF 업로드</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            직접 쓴 여행기 PDF를 올리면<br />
            내용을 바탕으로 질문에 답해드려요.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
            <UploadCloud className="h-3 w-3" />
            <span>드래그하거나 클릭하여 업로드</span>
          </div>
        </div>
      )}
    </div>
  );
}
