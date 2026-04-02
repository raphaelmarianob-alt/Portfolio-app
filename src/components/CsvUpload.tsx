"use client";

import { useRef, useState } from "react";

interface Props {
  onUploadComplete: () => void;
  endpoint?: string;
  label?: string;
}

export function CsvUpload({ onUploadComplete, endpoint = "/api/research/upload", label = "Upload CSV" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setResult(`${data.created} criados, ${data.updated} atualizados`);
        setIsSuccess(true);
        onUploadComplete();
      } else {
        setResult(`Erro: ${data.error}`);
        setIsSuccess(false);
      }
    } catch {
      setResult("Erro ao enviar arquivo");
      setIsSuccess(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="border border-[#2e3044] text-[#e4e4e7] px-4 py-2 rounded-lg text-sm hover:border-emerald-500 disabled:opacity-50"
      >
        {uploading ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Enviando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            {label}
          </span>
        )}
      </button>
      {result && (
        <span className={`text-xs px-2.5 py-1 rounded-lg ${isSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
