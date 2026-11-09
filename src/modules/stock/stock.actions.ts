"use server";

import { revalidatePath } from "next/cache";
import requireAdmin from "@/utils/auth/requireAdmin";
import { isUuid, parseDecimal } from "@/modules/costs/costs.utils";
import {
    MAX_MOVEMENT_REASON_LENGTH,
    MAX_PRODUCT_DESCRIPTION_LENGTH,
    MAX_PRODUCT_NAME_LENGTH,
    MAX_PRODUCT_PRICE,
    MAX_STOCK_QUANTITY,
    STOCK_PATH,
} from "@/modules/stock/stock.constants";
import { isManualMovementType, parseQuantity } from "@/modules/stock/stock.utils";
import type { ActionResult } from "@/modules/stock/stock.types";

// Todas las funciones exportadas de este archivo se pueden invocar con un POST
// directo: cada una valida el rol y la entrada en el servidor.

// El formulario de nuevo pedido lista los productos habilitados con su stock
function revalidateStock() {
    revalidatePath(STOCK_PATH);
    revalidatePath("/admin/orders");
}

const DUPLICATE_NAME_ERROR = "Ya hay un producto con ese nombre.";

type ProductFields = {
    name: string;
    description: string | null;
    price: number;
    min_stock: number;
};

function readPrice(raw: FormDataEntryValue | null): { price: number } | { error: string } {
    const price = parseDecimal(raw);
    if (price == null) {
        return { error: "Ingresá el precio como un número (puede ser 0)." };
    }
    if (price > MAX_PRODUCT_PRICE) {
        return { error: "El precio parece demasiado alto. Revisá que no sobre un cero." };
    }
    return { price: Math.round(price * 100) / 100 };
}

function readProductFields(formData: FormData): { fields: ProductFields } | { error: string } {
    const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
    if (!name) {
        return { error: "Ingresá el nombre del producto." };
    }
    if (name.length > MAX_PRODUCT_NAME_LENGTH) {
        return { error: `El nombre puede tener hasta ${MAX_PRODUCT_NAME_LENGTH} caracteres.` };
    }

    const description = String(formData.get("description") ?? "").trim();
    if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
        return { error: `La descripción puede tener hasta ${MAX_PRODUCT_DESCRIPTION_LENGTH} caracteres.` };
    }

    const price = readPrice(formData.get("price"));
    if ("error" in price) return price;

    const rawMinStock = String(formData.get("minStock") ?? "").trim();
    const minStock = rawMinStock ? parseQuantity(rawMinStock) : 0;
    if (minStock == null || minStock > MAX_STOCK_QUANTITY) {
        return { error: "El stock mínimo tiene que ser un número entero (puede ser 0)." };
    }

    return {
        fields: { name, description: description || null, price: price.price, min_stock: minStock },
    };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para crear productos." };
    }

    const parsed = readProductFields(formData);
    if ("error" in parsed) return parsed;

    const rawInitialStock = String(formData.get("initialStock") ?? "").trim();
    const initialStock = rawInitialStock ? parseQuantity(rawInitialStock) : 0;
    if (initialStock == null || initialStock > MAX_STOCK_QUANTITY) {
        return { error: "El stock inicial tiene que ser un número entero (puede ser 0)." };
    }

    const { error } = await supabase.rpc("create_product", {
        p_name: parsed.fields.name,
        p_description: parsed.fields.description ?? "",
        p_price: parsed.fields.price,
        p_min_stock: parsed.fields.min_stock,
        p_initial_stock: initialStock,
    });

    if (error) {
        return {
            error: error.code === "23505" ? DUPLICATE_NAME_ERROR : "No se pudo crear el producto: " + error.message,
        };
    }

    revalidateStock();
    return { ok: true };
}

export async function updateProduct(productId: string, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar productos." };
    }
    if (!isUuid(productId)) {
        return { error: "El producto no es válido." };
    }

    const parsed = readProductFields(formData);
    if ("error" in parsed) return parsed;

    // El trigger de la base guarda el precio anterior en el historial si cambió
    const { data, error } = await supabase
        .from("products")
        .update(parsed.fields)
        .eq("id", productId)
        .is("archived_at", null)
        .select("id");

    if (error) {
        return {
            error: error.code === "23505" ? DUPLICATE_NAME_ERROR : "No se pudo guardar el producto: " + error.message,
        };
    }
    if (!data || data.length === 0) {
        return { error: "El producto no existe o fue eliminado. Recargá la página." };
    }

    revalidateStock();
    return { ok: true };
}

// Deshabilitado: sigue en el listado y con su stock, pero no se puede pedir
export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para hacer esto." };
    }
    if (!isUuid(productId)) {
        return { error: "El producto no es válido." };
    }

    const { error } = await supabase
        .from("products")
        .update({ is_active: active })
        .eq("id", productId)
        .is("archived_at", null);

    if (error) {
        return {
            error: `No se pudo ${active ? "habilitar" : "deshabilitar"} el producto: ` + error.message,
        };
    }

    revalidateStock();
    return { ok: true };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para eliminar productos." };
    }
    if (!isUuid(productId)) {
        return { error: "El producto no es válido." };
    }

    const { data, error } = await supabase.rpc("delete_product", { p_product_id: productId });

    if (error) {
        return { error: "No se pudo eliminar el producto: " + error.message };
    }

    revalidateStock();
    return {
        ok: true,
        message:
            data === "archived"
                ? "Producto eliminado. Como aparece en pedidos, su historial se conserva."
                : "Producto eliminado.",
    };
}

export async function adjustStock(formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para mover stock." };
    }

    const productId = String(formData.get("productId") ?? "").trim();
    if (!isUuid(productId)) {
        return { error: "El producto no es válido." };
    }

    const type = String(formData.get("type") ?? "");
    if (!isManualMovementType(type)) {
        return { error: "Elegí el tipo de movimiento." };
    }

    const quantity = parseQuantity(formData.get("quantity"));
    if (quantity == null || (type !== "ajuste" && quantity === 0)) {
        return {
            error:
                type === "ajuste"
                    ? "Ingresá las unidades contadas como un número entero (puede ser 0)."
                    : "Ingresá la cantidad como un número entero mayor a cero.",
        };
    }
    if (quantity > MAX_STOCK_QUANTITY) {
        return { error: "La cantidad parece demasiado alta. Revisá que no sobre un cero." };
    }

    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length > MAX_MOVEMENT_REASON_LENGTH) {
        return { error: `El motivo puede tener hasta ${MAX_MOVEMENT_REASON_LENGTH} caracteres.` };
    }
    if (type !== "ingreso" && !reason) {
        return { error: "Contá el motivo (rotura, pérdida, conteo del depósito, etc.)." };
    }

    const { error } = await supabase.rpc("adjust_product_stock", {
        p_product_id: productId,
        p_type: type,
        p_quantity: quantity,
        p_reason: reason,
    });

    if (error) {
        return { error: error.message };
    }

    revalidateStock();
    return { ok: true };
}

export type PriceUpdate = { productId: string; price: number };

// Actualización de precios de varios productos a la vez (cada cambio queda en el historial)
export async function updatePrices(updates: PriceUpdate[]): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para cambiar precios." };
    }

    if (!Array.isArray(updates) || updates.length === 0) {
        return { error: "No cambiaste ningún precio." };
    }
    for (const update of updates) {
        if (!isUuid(update.productId)) {
            return { error: "Algún producto no es válido. Recargá la página." };
        }
        if (!Number.isFinite(update.price) || update.price < 0) {
            return { error: "Los precios tienen que ser números mayores o iguales a cero." };
        }
        if (update.price > MAX_PRODUCT_PRICE) {
            return { error: "Algún precio parece demasiado alto. Revisá que no sobre un cero." };
        }
    }

    const results = await Promise.all(
        updates.map((update) =>
            supabase
                .from("products")
                .update({ price: Math.round(update.price * 100) / 100 })
                .eq("id", update.productId)
                .is("archived_at", null),
        ),
    );

    revalidateStock();

    const failed = results.filter((result) => result.error).length;
    if (failed > 0) {
        return {
            error:
                failed === updates.length
                    ? "No se pudo actualizar ningún precio. Probá de nuevo."
                    : `Se actualizaron ${updates.length - failed} precios, pero ${failed} fallaron. Revisalos y probá de nuevo.`,
        };
    }

    return {
        ok: true,
        message: updates.length === 1 ? "Precio actualizado." : `${updates.length} precios actualizados.`,
    };
}
