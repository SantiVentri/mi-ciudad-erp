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

export type NewOrderItem = { productId: string; quantity: number };

export async function createOrder(
    clientId: string,
    arrivalDate: string,
    items: NewOrderItem[],
) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para crear pedidos." };
    }

    if (!clientId) {
        return { error: "Elegí un cliente." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
        return { error: "Fecha inválida." };
    }

    if (arrivalDate < todayKeyAR()) {
        return { error: "No podés crear un pedido con fecha pasada." };
    }

    if (items.length === 0) {
        return { error: "Agregá al menos un producto." };
    }

    if (items.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
        return { error: "Cada producto necesita una cantidad entera mayor a cero." };
    }

    const { data: orderId, error } = await supabase.rpc("create_order", {
        p_client_id: clientId,
        p_arrival_date: arrivalDate,
        p_items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
        })),
    });

    if (error) {
        return { error: "No se pudo crear el pedido: " + error.message };
    }

    revalidateOrdersAndRoutes();

    return { ok: true, orderId };
}

type AdminClient = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;

// Tope de pedidos por operación en lote (una página de la vista "Todos" son 20)
const MAX_BULK_ORDERS = 200;

// La base valida el resto: que no esté completado, ni en una ruta que ya salió, etc.
async function cancelOne(supabase: AdminClient, orderId: string, release: boolean) {
    const { error } = await supabase.rpc("cancel_order", {
        p_order_id: orderId,
        p_release: release,
    });

    return error ? cleanDbError(error.message) : null;
}

async function restoreOne(supabase: AdminClient, orderId: string) {
    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("arrival_date, state")
        .eq("id", orderId)
        .single();

    if (fetchError || !order) {
        return "No se encontró el pedido.";
    }

    if (order.state !== "Cancelada") {
        return "Solo se pueden restaurar pedidos cancelados.";
    }

    if (order.arrival_date.slice(0, 10) < todayKeyAR()) {
        return "El pedido tiene fecha pasada: usá Reprogramar.";
    }

    const { error } = await supabase
        .from("orders")
        .update({ state: "Pendiente" })
        .eq("id", orderId)
        .eq("state", "Cancelada");

    return error ? "No se pudo restaurar el pedido: " + error.message : null;
}

export async function cancelOrder(orderId: string, release = false) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para cancelar pedidos." };
    }

    const error = await cancelOne(supabase, orderId, release);
    if (error) {
        return { error };
    }

    revalidateOrdersAndRoutes();

    return { ok: true };
}

export async function restoreOrder(orderId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para restaurar pedidos." };
    }

    const error = await restoreOne(supabase, orderId);
    if (error) {
        return { error };
    }

    revalidateOrdersAndRoutes();

    return { ok: true };
}

export type BulkStateResult =
    | { error: string }
    | { done: number; failed: { orderId: string; error: string }[] };

/**
 * Cancela o restaura varios pedidos. Cada uno se procesa por separado: si alguno
 * falla (p. ej. su ruta salió mientras tanto), los demás se aplican igual y se
 * devuelve qué falló y por qué.
 * release (solo al cancelar): sacar de su ruta a los que estén en una que no salió
 * (el usuario ya lo confirmó).
 */
export async function setOrdersState(
    orderIds: string[],
    action: "cancel" | "restore",
    release = false,
): Promise<BulkStateResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return {
            error:
                action === "cancel"
                    ? "No tenés permisos para cancelar pedidos."
                    : "No tenés permisos para restaurar pedidos.",
        };
    }

    const ids = [...new Set(orderIds)];
    if (ids.length === 0) {
        return { error: "Seleccioná al menos un pedido." };
    }
    if (ids.length > MAX_BULK_ORDERS) {
        return { error: `Podés cambiar hasta ${MAX_BULK_ORDERS} pedidos a la vez.` };
    }

    const failed: { orderId: string; error: string }[] = [];

    // De a uno: cada cancelación bloquea el pedido y su ruta en la base
    for (const orderId of ids) {
        const error =
            action === "cancel"
                ? await cancelOne(supabase, orderId, release)
                : await restoreOne(supabase, orderId);
        if (error) failed.push({ orderId, error });
    }

    if (failed.length < ids.length) {
        revalidateOrdersAndRoutes();
    }

    return { done: ids.length - failed.length, failed };
}
