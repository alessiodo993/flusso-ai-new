import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/** Uscita: POST per non farla scattare da un prefetch o da un link visitato. */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, {
    status: 303,
  });
}
