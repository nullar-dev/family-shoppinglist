"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Round, Item, User, Allocation } from "@/types";

export default function AllocationsPage() {
  const { user, loading: userLoading, signOut } = useUser();
  const [round, setRound] = useState<Round | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Try to get roundId from URL params first
  const urlRoundId = searchParams.get("roundId");

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  const fetchData = useCallback(async () => {
    // Get round - either from URL or most recent REVIEW/SETTLED
    let roundData: Round | null = null;

    if (urlRoundId) {
      const { data } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", urlRoundId)
        .single();
      roundData = data;
    } else {
      const { data } = await supabase
        .from("rounds")
        .select("*")
        .in("state", ["REVIEW", "SETTLED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      roundData = data;
    }

    if (roundData) {
      setRound(roundData);

      // Get items for this round
      const { data: itemsData } = await supabase
        .from("items")
        .select("*")
        .eq("round_id", roundData.id);

      if (itemsData) {
        setItems(itemsData);
      }

      // Get allocations only for this round's items
      const itemIds = itemsData?.map(i => i.id) || [];
      if (itemIds.length > 0) {
        const { data: allocationsData } = await supabase
          .from("allocations")
          .select("*")
          .in("item_id", itemIds);

        if (allocationsData) {
          setAllocations(allocationsData);
        }
      }
    }

    // Get users
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .order("name");

    if (usersData) {
      setUsers(usersData);
    }

    setLoading(false);
  }, [supabase, urlRoundId]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!round?.id) return;

    const allocationsChannel = supabase
      .channel(`allocations-${round.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "allocations",
        },
        () => {
          // Refresh allocations when they change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(allocationsChannel);
    };
  }, [round?.id, supabase, fetchData]);

  const getUserById = (userId: string): User | undefined => {
    return users.find((u) => u.id === userId);
  };

  const getItemAllocations = (itemId: string) => {
    return allocations.filter((a) => a.item_id === itemId);
  };

  const calculateUserTotal = (userId: string) => {
    return allocations
      .filter((a) => a.user_id === userId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const handleAllocate = async (itemId: string, userId: string, split: boolean) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.estimated_price) return;

    // Remove existing allocations for this item
    await supabase.from("allocations").delete().eq("item_id", itemId);

    if (split) {
      // Split equally among all users
      const amountPerUser = item.estimated_price / users.length;
      const allocations = users.map((u) => ({
        item_id: itemId,
        user_id: u.id,
        amount: amountPerUser,
        percentage: 100 / users.length,
      }));
      await supabase.from("allocations").insert(allocations);
    } else {
      // Full amount to single user
      await supabase.from("allocations").insert({
        item_id: itemId,
        user_id: userId,
        amount: item.estimated_price,
        percentage: 100,
      });
    }

    // Refresh allocations
    const { data } = await supabase.from("allocations").select("*");
    if (data) setAllocations(data);
  };

  const handleSettleRound = async () => {
    if (!round) return;

    const totalAmount = items.reduce(
      (sum, item) => sum + (item.estimated_price || 0),
      0
    );

    // Update round
    await supabase
      .from("rounds")
      .update({
        state: "SETTLED",
        settled_at: new Date().toISOString(),
        total_amount: totalAmount,
      })
      .eq("id", round.id);

    // Create new OPEN round
    await supabase.from("rounds").insert({ state: "OPEN" });

    router.push("/dashboard");
  };

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
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Kostenverdeling
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {round ? `Ronde van ${new Date(round.created_at).toLocaleDateString("nl-NL")}` : "Geen ronde"}
            </p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* User Totals */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Per persoon
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="space-y-2">
              {users.map((u) => {
                const total = calculateUserTotal(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: u.color }}
                      ></div>
                      <span className="text-gray-900 dark:text-white">
                        {u.name}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      €{total.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Totaal
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  €{items.reduce((sum, i) => sum + (i.estimated_price || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Items Allocation */}
        {round?.state === "REVIEW" && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Verdeel kosten
            </h2>
            <div className="space-y-2">
              {items.map((item) => {
                const itemAllocations = getItemAllocations(item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        €{item.estimated_price?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {users.map((u) => {
                        const allocation = itemAllocations.find(
                          (a) => a.user_id === u.id
                        );
                        const isAllocated = allocation && allocation.amount > 0;
                        return (
                          <button
                            key={u.id}
                            onClick={() => handleAllocate(item.id, u.id, false)}
                            className={`px-2 py-1 text-xs rounded ${
                              isAllocated
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {u.name}
                          </button>
                        );
                      })}
                      <button
                        onClick={() =>
                          handleAllocate(
                            item.id,
                            users[0]?.id || "",
                            true
                          )
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          itemAllocations.length === users.length &&
                          itemAllocations.every((a) => a.amount > 0)
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        Gelijk
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Settle Button */}
        {round?.state === "REVIEW" && (
          <button
            onClick={handleSettleRound}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
          >
            Ronde afronden
          </button>
        )}

        {(!round || round.state === "SETTLED") && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Geen ronde om te verwerken
          </p>
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
          <a href="/allocations" className="flex-1 py-3 text-center text-blue-600 font-medium">
            Kosten
          </a>
        </div>
      </nav>
    </div>
  );
}
