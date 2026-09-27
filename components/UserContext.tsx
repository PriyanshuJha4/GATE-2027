"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile } from "@/lib/types";

interface UserContextValue {
  currentUser: UserProfile | null;
  users: UserProfile[];
  loading: boolean;
  selectUser: (user: UserProfile) => void;
  addUser: (
    name: string,
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  refreshUsers: () => Promise<UserProfile[]>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const ACTIVE_USER_KEY = "gate-dashboard-active-user-id";

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUsers = async (): Promise<UserProfile[]> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setUsers(data as UserProfile[]);
      return data as UserProfile[];
    }
    return [];
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fetchedUsers = await refreshUsers();

      const savedId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_USER_KEY)
          : null;

      if (savedId) {
        const restored = fetchedUsers.find((u) => u.id === savedId);
        if (restored) {
          setCurrentUser(restored);
        } else {
          window.localStorage.removeItem(ACTIVE_USER_KEY);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }

      setLoading(false);
    })();
  }, []);

  const selectUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_USER_KEY, user.id);
    }
  };

  const addUser = async (
    name: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      const { data: existingUser, error: fetchErr } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }

      if (existingUser) {
        await refreshUsers();
        selectUser(existingUser as UserProfile);
        return { success: true };
      }

      const { data, error: insertErr } = await supabase
        .from("users")
        .insert([{ name: cleanName, email: cleanEmail }])
        .select()
        .single();

      if (insertErr) {
        return { success: false, error: insertErr.message };
      }

      if (data) {
        await refreshUsers();
        selectUser(data as UserProfile);
        return { success: true };
      }

      return { success: false, error: "Failed to create user." };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const deleteUser = async (
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from("users").delete().eq("id", userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Local storage clear aur logout state
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ACTIVE_USER_KEY);
      }
      setCurrentUser(null);
      await refreshUsers();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete user." };
    }
  };

  const signOut = () => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        loading,
        selectUser,
        addUser,
        deleteUser,
        signOut,
        refreshUsers,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}