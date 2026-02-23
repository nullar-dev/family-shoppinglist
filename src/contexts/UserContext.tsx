"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

  useEffect(() => {
    // Check for existing session
    const checkUser = async () => {
      const storedUser = localStorage.getItem("gezins_user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    };
    checkUser();
  }, []);

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

      const user: User = {
        id: data.id,
        name: data.name,
        pin: data.pin,
        color: data.color,
        created_at: data.created_at,
      };

      localStorage.setItem("gezins_user", JSON.stringify(user));
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Er is iets misgegaan" };
    }
  };

  const signOut = async () => {
    localStorage.removeItem("gezins_user");
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
