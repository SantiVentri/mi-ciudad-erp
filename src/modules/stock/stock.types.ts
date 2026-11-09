import type {
    MANUAL_MOVEMENT_TYPES,
    MOVEMENT_TYPES,
    PRODUCT_STATUS_OPTIONS,
    STOCK_TABS,
} from "@/modules/stock/stock.constants";

export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];
export type ProductStatusFilter = (typeof PRODUCT_STATUS_OPTIONS)[number];
export type StockTabId = (typeof STOCK_TABS)[number]["id"];

export type ActionResult = { ok: true; message?: string } | { error: string };

// "out" = sin stock, "low" = en el mínimo o por debajo
export type StockLevel = "ok" | "low" | "out";

export type Product = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    minStock: number;
    isActive: boolean;
    createdAt: string;
    // Unidades en pedidos por entregar (ya descontadas del stock)
    committedUnits: number;
    // Unidades pedidas para entregar en los últimos 30 días
    unitsLast30d: number;
    // Aparece en algún pedido: eliminarlo lo archiva en vez de borrarlo
    hasOrders: boolean;
};

export type StockMovement = {
    id: string;
    productId: string;
    productName: string;
    type: MovementType;
    quantity: number;
    stockAfter: number;
    reason: string | null;
    order: { clientName: string | null; arrivalDate: string } | null;
    authorName: string | null;
    createdAt: string;
};

export type PriceChange = {
    id: string;
    productId: string;
    productName: string;
    price: number;
    previousPrice: number | null;
    authorName: string | null;
    createdAt: string;
};
