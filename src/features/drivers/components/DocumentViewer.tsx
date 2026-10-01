import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { fetchDocumentObjectUrl } from "../api/drivers";

interface DocumentViewerProps {
  title: string;
  path: string;
  onClose: () => void;
}

/** Modal that fetches an auth-protected document and previews it inline. */
export function DocumentViewer({ title, path, onClose }: DocumentViewerProps) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchDocumentObjectUrl(path)
      .then((result) => {
        objectUrl = result.url;
        if (cancelled) URL.revokeObjectURL(result.url);
        else setFile(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load the document");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-midnight">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !file ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading" />
          ) : file.type === "application/pdf" ? (
            <iframe src={file.url} title={title} className="h-[75vh] w-full rounded" />
          ) : (
            <img src={file.url} alt={title} className="max-h-[75vh] max-w-full rounded object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
