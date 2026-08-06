"use server";

import { revalidatePath } from "next/cache";

import { getServerClient } from "@/utils/supabase/getServerClient";

function todayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function updateOrderArrivalDate(orderId: string, arrivalDate: string) {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.app_metadata?.role !== "admin") {
        return { error: "No tenés permisos para editar pedidos." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
        return { error: "Fecha inválida." };
    }

    if (arrivalDate < todayDateString()) {
        return { error: "No podés fijar una fecha pasada para el pedido." };
    }

    const { error } = await supabase
        .from("orders")
        .update({ arrival_date: arrivalDate })
        .eq("id", orderId);

    if (error) {
        return { error: "No se pudo actualizar la fecha: " + error.message };
    }

    revalidatePath("/admin/orders");

    return { ok: true };
}