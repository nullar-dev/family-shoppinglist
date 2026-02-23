"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { showNotification, getNotificationMessage, NotificationType } from "@/lib/notifications";
import { User } from "@/types";

interface UseNotificationsOptions {
  roundId: string | null;
  currentUser: User | null;
}

export function useNotifications({ roundId, currentUser }: UseNotificationsOptions) {
  const supabase = createClient();
  const initialized = useRef(false);

  useEffect(() => {
    if (!roundId || !currentUser || initialized.current) return;

    initialized.current = true;

    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Subscribe to items changes
    const itemsChannel = supabase
      .channel(`notifications-items-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "items",
          filter: `round_id=eq.${roundId}`,
        },
        (payload) => {
          const item = payload.new;
          // Don't notify for items created by current user
          if (item.created_by_user_id !== currentUser.id) {
            const { title, body } = getNotificationMessage("new_item", {
              userName: "Iemand", // We'd need to fetch the user name
              itemName: item.name,
            });
            showNotification(title, { body });
          }
        }
      )
      .subscribe();

    // Subscribe to round state changes
    const roundsChannel = supabase
      .channel(`notifications-rounds-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rounds",
          filter: `id=eq.${roundId}`,
        },
        (payload) => {
          const newState = payload.new.state;
          const oldState = payload.old.state;

          // Notify on state changes
          if (newState === "LOCKED" && oldState !== "LOCKED") {
            // Round was locked - someone started shopping
          } else if (newState === "OPEN" && oldState === "LOCKED") {
            const { title, body } = getNotificationMessage("round_opened", {});
            showNotification(title, { body });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(roundsChannel);
    };
  }, [roundId, currentUser, supabase]);
}

// Hook to request notification permission
export function useNotificationPermission() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // We could show a UI button to request permission
      // For now, we'll just log it
      console.log("Notification permission:", Notification.permission);
    }
  }, []);
}
