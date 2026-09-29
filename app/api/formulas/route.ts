import { NextRequest, NextResponse } from "next/server";
import { turso } from "@/lib/tursoClient";
import crypto from "crypto";

// GET: All formulas
export async function GET() {
  try {
    const result = await turso.execute(
      "SELECT * FROM formulas ORDER BY subject ASC, topic ASC"
    );
    return NextResponse.json({ formulas: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Naya formula add karein
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, topic, title, formula_latex, explanation, tags } = body;

    if (!subject || !title || !formula_latex) {
      return NextResponse.json(
        { error: "Subject, title, and formula are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    await turso.execute({
      sql: `INSERT INTO formulas (id, subject, topic, title, formula_latex, explanation, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, subject, topic || "", title, formula_latex, explanation || "", tags || ""],
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}