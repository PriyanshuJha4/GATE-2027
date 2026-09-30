"use exact client";
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

export const SUPER_ADMIN_EMAIL = "jhaprem1.10@gmail.com";

interface UserContextValue {
  currentUser: UserProfile | null;
  adminUser: UserProfile | null;
  users: UserProfile[];
  loading: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  selectUser: (user: UserProfile) => void;
  switchBackToAdmin: () => void;
  loginOrRegister: (
    name: string,
    email: string,
    password?: string,
    securityQuestion?: string,
    securityAnswer?: string
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithSecurity: (
    email: string,
    securityAnswer: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  refreshUsers: () => Promise<UserProfile[]>;
  promoteToAdmin: (userId: string, newRole: "admin" | "student") => Promise<boolean>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const ACTIVE_USER_KEY = "gate-dashboard-active-user-id";
const ADMIN_ORIGINAL_KEY = "gate-dashboard-admin-id";

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
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

      const savedActiveId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_USER_KEY)
          : null;
      const savedAdminId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ADMIN_ORIGINAL_KEY)
          : null;

      if (savedAdminId) {
        const foundAdmin = fetchedUsers.find((u) => u.id === savedAdminId);
        if (foundAdmin) setAdminUser(foundAdmin);
      }

      if (savedActiveId) {
        const restored = fetchedUsers.find((u) => u.id === savedActiveId);
        if (restored) {
          setCurrentUser(restored);
          if (restored.role === "admin" || restored.email === SUPER_ADMIN_EMAIL) {
            setAdminUser(restored);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(ADMIN_ORIGINAL_KEY, restored.id);
            }
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const selectUser = (user: UserProfile) => {
    if ((currentUser?.role === "admin" || currentUser?.email === SUPER_ADMIN_EMAIL) && !adminUser) {
      setAdminUser(currentUser);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ADMIN_ORIGINAL_KEY, currentUser.id);
      }
    }

    setCurrentUser(user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_USER_KEY, user.id);
    }
  };

  const switchBackToAdmin = () => {
    if (adminUser) {
      setCurrentUser(adminUser);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_USER_KEY, adminUser.id);
        window.localStorage.removeItem(ADMIN_ORIGINAL_KEY);
      }
      setAdminUser(null);
    }
  };

  const loginOrRegister = async (
    name: string,
    email: string,
    password?: string,
    securityQuestion?: string,
    securityAnswer?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const role = cleanEmail === SUPER_ADMIN_EMAIL ? "admin" : "student";

    try {
      if (password) {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authErr) {
          const { error: signUpErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
          });

          if (signUpErr) return { success: false, error: signUpErr.message };
        }
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existingUser) {
        if (cleanEmail === SUPER_ADMIN_EMAIL && existingUser.role !== "admin") {
          await supabase.from("users").update({ role: "admin" }).eq("id", existingUser.id);
          existingUser.role = "admin";
        }
        await refreshUsers();
        selectUser(existingUser as UserProfile);
        return { success: true };
      }

      const insertData: any = {
        name: cleanName,
        email: cleanEmail,
        role,
      };

      if (role === "student") {
        insertData.security_question = securityQuestion || "Aapke favourite teacher ka naam kya hai?";
        insertData.security_answer = securityAnswer || "";
      }

      const { data: newUserData, error: insertErr } = await supabase
        .from("users")
        .insert([insertData])
        .select()
        .single();

      if (insertErr) return { success: false, error: insertErr.message };

      if (newUserData) {
        await refreshUsers();
        selectUser(newUserData as UserProfile);
        return { success: true };
      }

      return { success: false, error: "Failed to create user profile." };
    } catch (err: any) {
      return { success: false, error: err.message || "Authentication error" };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update password" };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to send reset link" };
    }
  };

  const resetPasswordWithSecurity = async (
    email: string,
    securityAnswer: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, securityAnswer, newPassword }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to reset password" };
    }
  };

  const promoteToAdmin = async (userId: string, newRole: "admin" | "student") => {
    const { error } = await supabase.from("users").update({ role: newRole }).eq("id", userId);
    if (!error) {
      await refreshUsers();
      return true;
    }
    return false;
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) return { success: false, error: error.message };

      signOut();
      await refreshUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete user." };
    }
  };

  const signOut = () => {
    setCurrentUser(null);
    setAdminUser(null);
    supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
      window.localStorage.removeItem(ADMIN_ORIGINAL_KEY);
    }
  };

  const isImpersonating = Boolean(adminUser && currentUser?.id !== adminUser.id);
  const isAdmin = Boolean(
    currentUser?.role === "admin" ||
    currentUser?.email === SUPER_ADMIN_EMAIL ||
    isImpersonating
  );

  return (
    <UserContext.Provider
      value={{
        currentUser,
        adminUser,
        users,
        loading,
        isAdmin,
        isImpersonating,
        selectUser,
        switchBackToAdmin,
        loginOrRegister,
        updatePassword,
        forgotPassword,
        resetPasswordWithSecurity,
        deleteUser,
        signOut,
        refreshUsers,
        promoteToAdmin,
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