"use server";

import { revalidatePath } from "next/cache";

import requireAdmin from "@/utils/auth/requireAdmin";
import { todayKeyAR } from "@/utils/dates/argentina";

type UpdateDateOptions = {
    // Sacar los pedidos de su ruta si están en una (el usuario ya lo confirmó)
    release?: boolean;
    // Volver a "Pendiente" los pedidos cancelados (Reprogramar)
    reactivate?: boolean;
};

function revalidateOrdersAndRoutes() {
    revalidatePath("/admin/orders");
    revalidatePath("/admin/routes");
}

// Postgres devuelve un prefijo técnico cuando el pedido está en una ruta
function cleanDbError(message: string) {
    return message.replace(/^PEDIDO_EN_RUTA:\s*/, "");
}

export async function updateOrdersArrivalDate(
    orderIds: string[],
    arrivalDate: string,
    options: UpdateDateOptions = {},
) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar pedidos." };
    }

    if (orderIds.length === 0) {
        return { error: "Seleccioná al menos un pedido." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
        return { error: "Fecha inválida." };
    }

    if (arrivalDate < todayKeyAR()) {
        return { error: "No podés fijar una fecha pasada para el pedido." };
    }

    const { error } = await supabase.rpc("change_orders_date", {
        p_order_ids: orderIds,
        p_new_date: arrivalDate,
        p_release: options.release ?? false,
        p_reactivate: options.reactivate ?? false,
    });

    if (error) {
        return { error: cleanDbError(error.message) };
    }

    revalidateOrdersAndRoutes();

    return { ok: true };
}

export async function cancelOrder(orderId: string, release = false) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para cancelar pedidos." };
    }

    const { error } = await supabase.rpc("cancel_order", {
        p_order_id: orderId,
        p_release: release,
    });

    if (error) {
        return { error: cleanDbError(error.message) };
    }

    revalidateOrdersAndRoutes();

    return { ok: true };
}

export async function restoreOrder(orderId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para restaurar pedidos." };
    }

    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("arrival_date, state")
        .eq("id", orderId)
        .single();

    if (fetchError || !order) {
        return { error: "No se encontró el pedido." };
    }

    if (order.state !== "Cancelada") {
        return { error: "Solo se pueden restaurar pedidos cancelados." };
    }

    if (order.arrival_date.slice(0, 10) < todayKeyAR()) {
        return { error: "El pedido tiene fecha pasada: usá Reprogramar." };
    }

    const { error } = await supabase
        .from("orders")
        .update({ state: "Pendiente" })
        .eq("id", orderId)
        .eq("state", "Cancelada");

    if (error) {
        return { error: "No se pudo restaurar el pedido: " + error.message };
    }

    revalidateOrdersAndRoutes();

    return { ok: true };
}
