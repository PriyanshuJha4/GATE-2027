import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error: Missing Supabase keys." },
        { status: 500 }
      );
    }

    // Client ko function ke andar initialize karein taaki build ke waqt error na aaye
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, securityAnswer, newPassword } = await request.json();

    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Fetch user by email to verify security answer
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // 2. Verify security answer (case-insensitive check)
    if (
      !userData.security_answer ||
      userData.security_answer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "Incorrect security answer." },
        { status: 400 }
      );
    }

    // 3. Update password using admin auth API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.id,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}