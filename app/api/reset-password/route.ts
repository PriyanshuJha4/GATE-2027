import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Email ke basis par user ka security question fetch karne ke liye
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ success: false, error: "Email zaroori hai." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { data: dbUser, error: dbErr } = await supabaseAdmin
      .from("users")
      .select("security_question")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (dbErr || !dbUser) {
      return NextResponse.json({ success: false, error: "Yeh email registered nahi hai." }, { status: 404 });
    }

    return NextResponse.json({ success: true, securityQuestion: dbUser.security_question });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Security answer verify karke password reset karne ke liye
export async function POST(req: Request) {
  try {
    const { email, securityAnswer, newPassword } = await req.json();
    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json({ success: false, error: "Sabhi fields bharna zaroori hai." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check user & security answer in public.users table
    const { data: dbUser, error: dbErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (dbErr || !dbUser) {
      return NextResponse.json({ success: false, error: "Yeh email registered nahi hai." }, { status: 404 });
    }

    // Verify security answer (case-insensitive trim check)
    if (!dbUser.security_answer || dbUser.security_answer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      return NextResponse.json({ success: false, error: "Security answer galat hai!" }, { status: 400 });
    }

    // 2. Find auth user id from Supabase Auth
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ success: false, error: listError.message }, { status: 400 });
    }

    const authUser = listData.users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Auth user nahi mila." }, { status: 404 });
    }

    // 3. Update password directly via Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}