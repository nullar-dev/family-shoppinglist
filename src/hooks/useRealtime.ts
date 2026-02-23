"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Round, Item, User, PresenceState } from "@/types";

export function useRealtime(roundId: string | null, currentUser: User | null) {
  const [round, setRound] = useState<Round | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!roundId) {
      setLoading(false);
      return;
    }

    // Get current round
    const { data: roundData } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", roundId)
      .single();

    if (roundData) {
      setRound(roundData);
    }

    // Get items for this round
    const { data: itemsData } = await supabase
      .from("items")
      .select("*")
      .eq("round_id", roundId)
      .order("created_at", { ascending: true });

    if (itemsData) {
      setItems(itemsData);
    }

    // Get all users
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .order("name");

    if (usersData) {
      setUsers(usersData);
    }

    setLoading(false);
  }, [roundId, supabase]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!roundId) return;

    // Fetch initial data
    fetchData();

    // Subscribe to round changes
    const roundChannel = supabase
      .channel(`round-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rounds",
          filter: `id=eq.${roundId}`,
        },
        (payload) => {
          if (payload.new) {
            setRound(payload.new as Round);
          }
        }
      )
      .subscribe();

    // Subscribe to items changes
    const itemsChannel = supabase
      .channel(`items-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `round_id=eq.${roundId}`,
        },
        (payload) => {
          console.log("📡 Realtime event:", payload.eventType, payload);
          if (payload.eventType === "INSERT") {
            setItems((prev) => [...prev, payload.new as Item]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? (payload.new as Item) : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            // Keep item in array for animation, but mark as deleted via callback
            console.log("📡 REALTIME DELETE received for item:", payload.old.id);
            setDeletedItemIds((prev) => [...prev, payload.old.id]);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Items channel subscription status:", status);
      });

    // Presence channel for online users (per round to avoid conflicts)
    const presenceChannel = supabase.channel(`presence-${roundId}`);

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<PresenceState>();
        const online: PresenceState[] = [];
        for (const id in state) {
          const presences = state[id];
          if (presences[0]) {
            online.push(presences[0]);
          }
        }
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && currentUser) {
          await presenceChannel.track({
            user_id: currentUser.id,
            user_name: currentUser.name,
            color: currentUser.color,
          });
        }
      });

    return () => {
      supabase.removeChannel(roundChannel);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [roundId, supabase, currentUser, fetchData]);

  return { round, items, users, onlineUsers, deletedItemIds, clearDeletedItemIds: () => setDeletedItemIds([]), loading, refetch: fetchData };
}

// Hook to get the current open round with realtime updates
export function useCurrentRound() {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch current round (OPEN or LOCKED, not SETTLED)
  const fetchCurrentRound = useCallback(async () => {
    // First try to find an OPEN round
    const { data: openRound } = await supabase
      .from("rounds")
      .select("id")
      .eq("state", "OPEN")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (openRound) {
      setRoundId(openRound.id);
      setLoading(false);
      return;
    }

    // If no OPEN round, check for LOCKED round
    const { data: lockedRound } = await supabase
      .from("rounds")
      .select("id")
      .eq("state", "LOCKED")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lockedRound) {
      setRoundId(lockedRound.id);
      setLoading(false);
      return;
    }

    // No OPEN or LOCKED round exists, create new OPEN round
    const { data: newRound, error } = await supabase
      .from("rounds")
      .insert({ state: "OPEN" })
      .select("id")
      .single();

    if (newRound) {
      setRoundId(newRound.id);
    } else if (error) {
      console.error("Error creating round:", error);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCurrentRound();

    // Subscribe to rounds table to detect new OPEN rounds
    const roundsChannel = supabase
      .channel("rounds-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rounds",
          filter: "state=eq.OPEN",
        },
        (payload) => {
          // New OPEN round created - switch to it
          if (payload.new && payload.new.id !== roundId) {
            setRoundId(payload.new.id);
            setLoading(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roundsChannel);
    };
  }, [supabase, fetchCurrentRound, roundId]);

  return { roundId, loading, refetch: fetchCurrentRound };
}
