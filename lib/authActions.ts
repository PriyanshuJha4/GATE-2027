import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. Password Create / Update
export async function updateAdminPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(error.message);
  return data;
}

// 2. Password Delete (fallback to OTP)
export async function removeAdminPassword() {
  const dummyPassword = crypto.randomUUID() + "-" + crypto.randomUUID();
  const { error } = await supabase.auth.updateUser({
    password: dummyPassword,
  });
  if (error) throw new Error(error.message);
  return true;
}

// 3. Forgot Password Link Email
export async function sendForgotPasswordEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/admin/reset-password`,
  });
  if (error) throw new Error(error.message);
  return data;
}