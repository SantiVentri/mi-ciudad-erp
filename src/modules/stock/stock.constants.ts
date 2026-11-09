export const STOCK_PATH = "/admin/stock";

// Topes de validación (evitan errores de tipeo como un cero de más)
export const MAX_PRODUCT_NAME_LENGTH = 80;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 300;
export const MAX_PRODUCT_PRICE = 10_000_000;
export const MAX_STOCK_QUANTITY = 1_000_000;
export const MAX_MOVEMENT_REASON_LENGTH = 300;

// Filas de historial que se traen (movimientos y cambios de precio)
export const STOCK_HISTORY_LIMIT = 500;

// Valores de stock_movements.type (CHECK de la base)
export const MOVEMENT_TYPES = ["ingreso", "egreso", "ajuste", "pedido", "devolucion"] as const;

export const MOVEMENT_TYPE_LABELS: Record<(typeof MOVEMENT_TYPES)[number], string> = {
    ingreso: "Ingreso",
    egreso: "Egreso",
    ajuste: "Ajuste",
    pedido: "Pedido",
    devolucion: "Devolución",
};

// Los que carga el admin a mano (pedido y devolución salen solos de los pedidos)
export const MANUAL_MOVEMENT_TYPES = ["ingreso", "egreso", "ajuste"] as const;

export const MANUAL_MOVEMENT_OPTIONS: Record<
    (typeof MANUAL_MOVEMENT_TYPES)[number],
    { label: string; hint: string; quantityLabel: string }
> = {
    ingreso: {
        label: "Ingreso",
        hint: "Entra mercadería: producción, compra a un proveedor o devolución de un cliente.",
        quantityLabel: "Unidades que entran",
    },
    egreso: {
        label: "Egreso",
        hint: "Sale mercadería que no es un pedido: rotura, vencimiento, muestra o pérdida.",
        quantityLabel: "Unidades que salen",
    },
    ajuste: {
        label: "Ajuste por conteo",
        hint: "Contaste el depósito y el número no coincide: cargá lo que hay en realidad.",
        quantityLabel: "Unidades contadas",
    },
};

export const PRODUCT_STATUS_OPTIONS = ["Todos", "Activo", "Deshabilitado", "Stock bajo", "Sin stock"] as const;

export const STOCK_TABS = [
    { id: "productos", label: "Productos" },
    { id: "movimientos", label: "Movimientos" },
    { id: "precios", label: "Historial de precios" },
] as const;
