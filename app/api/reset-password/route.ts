import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

// 1. GET Method: ईमेल के जरिए यूजर का सिक्योरिटी क्वेश्चन लाने के लिए (405 एरर को फिक्स करने हेतु)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error: Missing Supabase keys." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const cleanEmail = email.trim().toLowerCase();

    // डेटाबेस से यूजर का सिक्योरिटी क्वेश्चन खोजें
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("security_question, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      securityQuestion: userData.security_question || "Aapke favourite teacher ka naam kya hai?",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 2. POST Method: सिक्योरिटी आंसर वेरीफाई करके नया पासवर्ड सेट करने के लिए
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