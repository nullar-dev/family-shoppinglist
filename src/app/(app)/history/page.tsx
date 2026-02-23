"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Round, User } from "@/types";

export default function HistoryPage() {
  const { user, loading: userLoading, signOut } = useUser();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  const fetchData = useCallback(async () => {
    // Get all non-OPEN rounds
    const { data: roundsData } = await supabase
      .from("rounds")
      .select("*")
      .neq("state", "OPEN")
      .order("created_at", { ascending: false });

    if (roundsData) {
      setRounds(roundsData);
    }

    // Get users for display
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .order("name");

    if (usersData) {
      setUsers(usersData);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Subscribe to realtime updates for new settled rounds
  useEffect(() => {
    const channel = supabase
      .channel("history-rounds")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rounds",
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchData]);

  const getUserById = (userId: string | null): User | undefined => {
    if (!userId) return undefined;
    return users.find((u) => u.id === userId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case "LOCKED":
        return "Bezig";
      case "REVIEW":
        return "Controleren";
      case "SETTLED":
        return "Afgerond";
      default:
        return state;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "LOCKED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "REVIEW":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "SETTLED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
              Geschiedenis
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Eerdere boodschappenrondes
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
        <div className="space-y-3">
          {rounds.map((round) => (
            <div
              key={round.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(round.created_at)}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(
                    round.state
                  )}`}
                >
                  {getStateLabel(round.state)}
                </span>
              </div>
              {round.locked_by_user_id && (
                <div className="flex items-center gap-1 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getUserById(round.locked_by_user_id)?.color || "#888" }}
                  ></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getUserById(round.locked_by_user_id)?.name} deed de boodschappen
                  </span>
                </div>
              )}
              {round.total_amount > 0 && (
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  €{round.total_amount.toFixed(2)}
                </p>
              )}
            </div>
          ))}
          {rounds.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Nog geen afgeronde rondes
            </p>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-lg mx-auto flex justify-around">
          <a href="/dashboard" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Lijst
          </a>
          <a href="/history" className="flex-1 py-3 text-center text-blue-600 font-medium">
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
