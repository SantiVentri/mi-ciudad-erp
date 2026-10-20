"use server";

import requireAdmin from "@/utils/auth/requireAdmin";
import { revalidatePath } from "next/cache";
import { getClientOrders } from "@/modules/clients/clients.dal";
import { geocodeAddress } from "@/modules/clients/clients.geocoding";

function readClientFields(formData: FormData) {
    return {
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        street: String(formData.get("street") ?? "").trim(),
        number: String(formData.get("number") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        province: String(formData.get("province") ?? "").trim(),
    };
}

function validateClientFields(fields: ReturnType<typeof readClientFields>) {
    const { name, email, phone, street, number, city, province } = fields;

    if (!name || !email || !phone || !street || !number || !city || !province) {
        return "Completá todos los campos obligatorios.";
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return "El email no es válido.";
    }

    return null;
}

export async function createClient(formData: FormData) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para crear clientes." };
    }

    const fields = readClientFields(formData);
    const validationError = validateClientFields(fields);
    if (validationError) {
        return { error: validationError };
    }

    // Calculamos las coordenadas antes de insertar
    const coords = await geocodeAddress(fields.street, fields.number, fields.city, fields.province);

    const { error } = await supabase.from("clients").insert({ ...fields, ...coords, is_active: true });

    if (error) {
        return { error: "No se pudo crear el cliente: " + error.message };
    }

    revalidatePath("/admin/clients");
    return { ok: true };
}

export async function updateClient(clientId: string, formData: FormData) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar clientes." };
    }

    const fields = readClientFields(formData);
    const validationError = validateClientFields(fields);
    if (validationError) {
        return { error: validationError };
    }

    const { data: current } = await supabase
        .from("clients")
        .select("street, number, city, province, latitude, longitude")
        .eq("id", clientId)
        .single();

    const addressChanged =
        !current ||
        current.street !== fields.street ||
        current.number !== fields.number ||
        current.city !== fields.city ||
        current.province !== fields.province;

    // Solo se geocodifica si cambió el domicilio o todavía no tiene coordenadas.
    // Así una falla momentánea de Nominatim no borra coordenadas que ya estaban bien.
    const needsCoordinates = addressChanged || current.latitude == null || current.longitude == null;

    const coords = needsCoordinates
        ? await geocodeAddress(fields.street, fields.number, fields.city, fields.province)
        : {};

    const { error } = await supabase.from("clients").update({ ...fields, ...coords }).eq("id", clientId);

    if (error) {
        return { error: "No se pudo actualizar el cliente: " + error.message };
    }

    revalidatePath("/admin/clients");
    return { ok: true };
}

export async function deleteClient(clientId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para eliminar clientes." };
    }

    const { error } = await supabase.from("clients").update({ is_active: false }).eq("id", clientId);

    if (error) {
        return { error: "No se pudo eliminar el cliente: " + error.message };
    }

    revalidatePath("/admin/clients");
    return { ok: true };
}

export async function restoreClient(clientId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para hacer esto." };
    }

    const { error } = await supabase.from("clients").update({ is_active: true }).eq("id", clientId);

    if (error) {
        return { error: "No se pudo restaurar el cliente: " + error.message };
    }

    revalidatePath("/admin/clients");
    return { ok: true };
}

export async function getClientOrderHistory(clientId: string) {
    const orders = await getClientOrders(clientId);

    if (!orders) {
        return { error: "No se pudo cargar el historial del cliente." };
    }

    return { orders };
}