"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Round, Item, ReceiptLine } from "@/types";

export default function ReceiptReviewPage() {
  const { user, loading: userLoading, signOut } = useUser();
  const [round, setRound] = useState<Round | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const roundId = searchParams.get("roundId");

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!roundId || !user) {
        setLoading(false);
        return;
      }

      // Get round
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundData) {
        // Access control: only allow shopper (LOCKED) or anyone in REVIEW/SETTLED
        const isShopper = roundData.locked_by_user_id === user.id;
        const canView = roundData.state === "LOCKED" && isShopper ||
                        roundData.state === "REVIEW" ||
                        roundData.state === "SETTLED";

        if (!canView) {
          router.push("/dashboard");
          return;
        }

        setRound(roundData);

        // Get items
        const { data: itemsData } = await supabase
          .from("items")
          .select("*")
          .eq("round_id", roundId);

        if (itemsData) {
          setItems(itemsData);
        }

        // Get receipt lines
        const { data: receiptData } = await supabase
          .from("receipt_lines")
          .select("*")
          .eq("round_id", roundId)
          .order("line_number");

        if (receiptData) {
          setReceiptLines(receiptData);
        }
      }

      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user, roundId, supabase]);

  const handleMatchLine = async (lineId: string, itemId: string | null) => {
    await supabase
      .from("receipt_lines")
      .update({ matched_item_id: itemId })
      .eq("id", lineId);

    setReceiptLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, matched_item_id: itemId } : line
      )
    );
  };

  const handleIgnoreLine = async (lineId: string) => {
    await supabase
      .from("receipt_lines")
      .update({ is_ignored: true })
      .eq("id", lineId);

    setReceiptLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, is_ignored: true } : line
      )
    );
  };

  const handleProceedToAllocations = () => {
    // Pass roundId to allocations page via URL
    if (roundId) {
      router.push(`/allocations?roundId=${roundId}`);
    } else {
      router.push("/allocations");
    }
  };

  // For now, simulate receipt lines from the uploaded image
  // In a real app, you'd use OCR or manual entry
  const handleAddReceiptLine = async () => {
    if (!roundId) return;

    const newLineNumber = receiptLines.length + 1;
    const { data } = await supabase
      .from("receipt_lines")
      .insert({
        round_id: roundId,
        line_number: newLineNumber,
        description: "",
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      })
      .select()
      .single();

    if (data) {
      setReceiptLines((prev) => [...prev, data]);
    }
  };

  const handleUpdateLine = async (
    lineId: string,
    field: string,
    value: string | number
  ) => {
    const update: Record<string, unknown> = { [field]: value };
    if (field === "unit_price" || field === "quantity") {
      const line = receiptLines.find((l) => l.id === lineId);
      if (line) {
        const qty = field === "quantity" ? Number(value) : line.quantity;
        const price = field === "unit_price" ? Number(value) : line.unit_price;
        update.total_price = qty * price;
      }
    }

    await supabase.from("receipt_lines").update(update).eq("id", lineId);

    setReceiptLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, ...update } : line
      )
    );
  };

  const matchedLines = receiptLines.filter((l) => l.matched_item_id);
  const unmatchedLines = receiptLines.filter(
    (l) => !l.matched_item_id && !l.is_ignored
  );
  const ignoredLines = receiptLines.filter((l) => l.is_ignored);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Bon controleren
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Match bonregels aan items
              </p>
            </div>
          </div>
          <button onClick={signOut} className="p-2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Receipt Image */}
        {round?.receipt_path && (
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm">
              <img
                src={round.receipt_path}
                alt="Receipt"
                className="w-full rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Gematcht: {matchedLines.length}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Niet gematcht: {unmatchedLines.length}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Genegeerd: {ignoredLines.length}
            </span>
          </div>
        </div>

        {/* Receipt Lines */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Bonregels
            </h2>
            <button
              onClick={handleAddReceiptLine}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Regel toevoegen
            </button>
          </div>

          <div className="space-y-2">
            {receiptLines.map((line) => (
              <div
                key={line.id}
                className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm ${
                  line.is_ignored ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">#{line.line_number}</span>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) =>
                      handleUpdateLine(line.id, "description", e.target.value)
                    }
                    placeholder="Omschrijving"
                    className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  />
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) =>
                      handleUpdateLine(line.id, "quantity", e.target.value)
                    }
                    className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    placeholder="Aantal"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) =>
                      handleUpdateLine(line.id, "unit_price", e.target.value)
                    }
                    className="w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    placeholder="Prijs"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    €{line.total_price.toFixed(2)}
                  </span>
                  <div className="flex gap-1">
                    {!line.is_ignored && (
                      <>
                        <button
                          onClick={() => handleIgnoreLine(line.id)}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Negeer
                        </button>
                        <select
                          value={line.matched_item_id || ""}
                          onChange={(e) =>
                            handleMatchLine(
                              line.id,
                              e.target.value || null
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        >
                          <option value="">Match met...</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>

                {line.matched_item_id && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-green-600 dark:text-green-400">
                      ✓ Gematcht met:{" "}
                      {items.find((i) => i.id === line.matched_item_id)?.name}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {receiptLines.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Geen bonregels. Klik "+ Regel toevoegen" om te beginnen.
              </p>
            )}
          </div>
        </section>

        {/* Proceed Button */}
        {receiptLines.length > 0 && (
          <button
            onClick={handleProceedToAllocations}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            Naar Kostenverdeling
          </button>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-lg mx-auto flex justify-around">
          <a href="/dashboard" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Lijst
          </a>
          <a href="/history" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Geschiedenis
          </a>
          <a href="/allocations" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Kosten
          </a>
        </div>
      </nav>
    </div>
  );
}
