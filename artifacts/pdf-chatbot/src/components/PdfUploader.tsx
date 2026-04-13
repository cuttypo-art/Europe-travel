import { useState, useRef } from "react";
import { useUploadPdf, useGetPdfStatus } from "@workspace/api-client-react";
import { UploadCloud, FileText, CheckCircle2, Loader2, X } from "lucide-react";
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
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadPdf.mutateAsync({ data: { file } });
      toast({
        title: "Upload complete",
        description: "Your PDF has been successfully indexed.",
      });
      refetchStatus();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your PDF.",
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
        <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Document Ready</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {status.filename || "Your document"} is indexed ({status.chunkCount} chunks).
        </p>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Upload different PDF
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
      className={`flex flex-col items-center justify-center h-full p-8 text-center border-2 border-dashed rounded-xl transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Processing PDF...</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            We are extracting and indexing the text. This might take a moment.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary/80 transition-colors">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Upload a PDF</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Drag and drop a PDF here, or click to browse. We'll index it so you can ask questions.
          </p>
        </div>
      )}
    </div>
  );
}
