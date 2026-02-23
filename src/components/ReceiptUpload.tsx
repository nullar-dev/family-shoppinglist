"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface ReceiptUploadProps {
  roundId: string;
  onUploadComplete: () => void;
}

export function ReceiptUpload({ roundId, onUploadComplete }: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${roundId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      // Update round with receipt path
      await supabase
        .from("rounds")
        .update({
          receipt_path: urlData.publicUrl,
          receipt_uploaded_at: new Date().toISOString(),
          state: "REVIEW",
        })
        .eq("id", roundId);

      onUploadComplete();
    } catch (err) {
      setError("Upload mislukt. Probeer opnieuw.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="font-medium text-gray-900 dark:text-white mb-3">
        Bon uploaden
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Upload een foto van de kassabon om kosten te matchen
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="block w-full text-sm text-gray-500 dark:text-gray-400
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-medium
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          dark:file:bg-blue-900 dark:file:text-blue-300
          disabled:opacity-50"
      />
      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
