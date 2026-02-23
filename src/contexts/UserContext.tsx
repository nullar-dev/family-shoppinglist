"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@/types";

interface UserContextType {
  user: User | null;
  loading: boolean;
  signIn: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Validate session against database
  const validateSession = useCallback(async () => {
    const storedUser = localStorage.getItem("gezins_user");
    const storedSessionId = localStorage.getItem("gezins_session_id");

    if (!storedUser || !storedSessionId) {
      return false;
    }

    const parsedUser = JSON.parse(storedUser);

    const { data, error } = await supabase
      .from("users")
      .select("session_id")
      .eq("id", parsedUser.id)
      .single();

    if (error || !data) {
      // User not found, clear session
      localStorage.removeItem("gezins_user");
      localStorage.removeItem("gezins_session_id");
      setUser(null);
      return false;
    }

    if (data.session_id !== storedSessionId) {
      // Session ID doesn't match - another device logged in
      localStorage.removeItem("gezins_user");
      localStorage.removeItem("gezins_session_id");
      setUser(null);
      return false;
    }

    // Session valid
    setUser(parsedUser);
    return true;
  }, [supabase]);

  // Initial session check
  useEffect(() => {
    const checkUser = async () => {
      await validateSession();
      setLoading(false);
    };
    checkUser();
  }, [validateSession]);

  // Periodic session validation (every 30 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const storedSessionId = localStorage.getItem("gezins_session_id");
      if (!storedSessionId) return;

      const { data } = await supabase
        .from("users")
        .select("session_id")
        .eq("id", user.id)
        .single();

      if (data && data.session_id !== storedSessionId) {
        // Session invalidated by another login
        localStorage.removeItem("gezins_user");
        localStorage.removeItem("gezins_session_id");
        setUser(null);
        window.location.href = "/login";
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, supabase]);

  // Subscribe to realtime session changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`session-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Check if session_id changed
          const storedSessionId = localStorage.getItem("gezins_session_id");
          if (payload.new && payload.new.session_id !== storedSessionId) {
            // Another device logged in - force logout
            localStorage.removeItem("gezins_user");
            localStorage.removeItem("gezins_session_id");
            setUser(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const signIn = async (name: string, pin: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("name", name)
        .eq("pin", pin)
        .single();

      if (error || !data) {
        return { success: false, error: "Ongeldige naam of PIN" };
      }

      // Generate new session ID to invalidate any other sessions
      const newSessionId = crypto.randomUUID();

      // Update session_id in database
      await supabase
        .from("users")
        .update({ session_id: newSessionId })
        .eq("id", data.id);

      const user: User = {
        id: data.id,
        name: data.name,
        pin: data.pin,
        color: data.color,
        created_at: data.created_at,
      };

      localStorage.setItem("gezins_user", JSON.stringify(user));
      localStorage.setItem("gezins_session_id", newSessionId);
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Er is iets misgegaan" };
    }
  };

  const signOut = async () => {
    // Clear local session
    localStorage.removeItem("gezins_user");
    localStorage.removeItem("gezins_session_id");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
