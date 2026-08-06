"use server";

import { getServerClient } from "@/utils/supabase/getServerClient";
import { revalidatePath } from "next/cache";

export async function createInvitation(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;

  if (!email || !role) {
    return { error: "Completá el email y el rol." };
  }

  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "No tenés permisos para invitar usuarios." };
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({ email, role, invited_by: user.id })
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo crear la invitación: " + error.message };
  }

  revalidatePath("/admin/invitations");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { link: `${siteUrl}/invite/${data.id}` };
}