import type { Client } from "@/modules/clients/clients.dal";
import type { ClientFormValues } from "@/modules/clients/clients.types";

export function getClientStatus(client: Client): "Activo" | "Inactivo" {
    return client.is_active === false ? "Inactivo" : "Activo";
}

export function getClientFormValues(client?: Client | null): ClientFormValues {
    return {
        name: client?.name ?? "",
        email: client?.email ?? "",
        phone: client?.phone ?? "",
        street: client?.street ?? "",
        number: client?.number ?? "",
        city: client?.city ?? "",
        province: client?.province ?? "",
    };
}

export function matchesSearch(client: Client, term: string) {
    if (!term) return true;

    const haystack = [client.name, client.email, client.phone, client.street, client.city, client.province]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(term.toLowerCase());
}