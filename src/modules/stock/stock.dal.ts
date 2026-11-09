import "server-only";
import { cache } from "react";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { getCurrentUser } from "@/utils/auth/getCurrentUser";
import { assertNoSupabaseError } from "@/utils/supabase/assertNoError";
import { fullName } from "@/modules/costs/costs.utils";
import { STOCK_HISTORY_LIMIT } from "@/modules/stock/stock.constants";
import { isMovementType } from "@/modules/stock/stock.utils";
import type { PriceChange, Product, StockMovement } from "@/modules/stock/stock.types";

// Movimientos e historial de precios: solo admin. RLS también lo impide, pero se
// corta antes para no depender solo de la base.
async function getAdminClient() {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return null;
    return getServerClient();
}

type AuthorRow = { first_name: string | null; last_name: string | null } | null;

const authorName = (author: AuthorRow) => (author ? fullName(author, "") || null : null);

// Productos en uso (los archivados no se muestran), con su demanda
export const getProducts = cache(async (): Promise<Product[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const [productsRes, statsRes] = await Promise.all([
        supabase
            .from("products")
            .select("id, name, description, price, stock, min_stock, is_active, created_at")
            .is("archived_at", null)
            .order("name", { ascending: true }),
        supabase
            .from("product_order_stats")
            .select("product_id, committed_units, units_last_30d, has_orders"),
    ]);

    assertNoSupabaseError(productsRes.error, "Error trayendo los productos");
    assertNoSupabaseError(statsRes.error, "Error trayendo la demanda de los productos");

    const stats = new Map((statsRes.data ?? []).map((row) => [row.product_id, row]));

    return (productsRes.data ?? []).map((row) => {
        const stat = stats.get(row.id);
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            price: Number(row.price),
            stock: row.stock,
            minStock: row.min_stock,
            isActive: row.is_active,
            createdAt: row.created_at,
            committedUnits: stat?.committed_units ?? 0,
            unitsLast30d: stat?.units_last_30d ?? 0,
            hasOrders: stat?.has_orders ?? false,
        };
    });
});

type MovementQueryRow = {
    id: string;
    product_id: string;
    type: string;
    quantity: number;
    stock_after: number;
    reason: string | null;
    created_at: string;
    product: { name: string } | null;
    order: { arrival_date: string; client: { name: string } | null } | null;
    author: AuthorRow;
};

// Últimos movimientos de todos los productos (incluidos los archivados)
export const getStockMovements = cache(async (): Promise<StockMovement[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("stock_movements")
        .select(
            `
                id, product_id, type, quantity, stock_after, reason, created_at,
                product:products ( name ),
                order:orders ( arrival_date, client:clients ( name ) ),
                author:profiles!stock_movements_created_by_fkey ( first_name, last_name )
            `,
        )
        .order("created_at", { ascending: false })
        .limit(STOCK_HISTORY_LIMIT);

    assertNoSupabaseError(error, "Error trayendo los movimientos de stock");

    return ((data ?? []) as MovementQueryRow[])
        .filter((row) => isMovementType(row.type))
        .map((row) => ({
            id: row.id,
            productId: row.product_id,
            productName: row.product?.name ?? "Producto eliminado",
            type: row.type as StockMovement["type"],
            quantity: row.quantity,
            stockAfter: row.stock_after,
            reason: row.reason,
            order: row.order
                ? { clientName: row.order.client?.name ?? null, arrivalDate: row.order.arrival_date }
                : null,
            authorName: authorName(row.author),
            createdAt: row.created_at,
        }));
});

type PriceQueryRow = {
    id: string;
    product_id: string;
    price: number;
    previous_price: number | null;
    created_at: string;
    product: { name: string } | null;
    author: AuthorRow;
};

export const getPriceHistory = cache(async (): Promise<PriceChange[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("product_prices")
        .select(
            `
                id, product_id, price, previous_price, created_at,
                product:products ( name ),
                author:profiles!product_prices_created_by_fkey ( first_name, last_name )
            `,
        )
        .order("created_at", { ascending: false })
        .limit(STOCK_HISTORY_LIMIT);

    assertNoSupabaseError(error, "Error trayendo el historial de precios");

    return ((data ?? []) as PriceQueryRow[]).map((row) => ({
        id: row.id,
        productId: row.product_id,
        productName: row.product?.name ?? "Producto eliminado",
        price: Number(row.price),
        previousPrice: row.previous_price == null ? null : Number(row.previous_price),
        authorName: authorName(row.author),
        createdAt: row.created_at,
    }));
});
