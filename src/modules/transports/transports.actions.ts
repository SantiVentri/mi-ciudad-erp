"use server";

import { revalidatePath } from "next/cache";

import { getServerClient } from "@/utils/supabase/getServerClient";
import { createInvitation } from "@/app/(home)/admin/invitations/actions";

async function requireAdmin() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.app_metadata?.role !== "admin") {
        return null;
    }

    return supabase;
}

function readVehicleFields(formData: FormData) {
    return {
        patent: String(formData.get("patent") ?? "").trim().toUpperCase(),
    };
}

function validateVehicleFields(fields: ReturnType<typeof readVehicleFields>) {
    if (!fields.patent) {
        return "Ingresá la patente del vehículo.";
    }

    return null;
}

export async function createVehicle(formData: FormData) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para crear vehículos." };
    }

    const fields = readVehicleFields(formData);
    const validationError = validateVehicleFields(fields);
    if (validationError) {
        return { error: validationError };
    }

    const { error } = await supabase.from("vehicles").insert({ ...fields, is_active: true });

    if (error) {
        return { error: "No se pudo crear el vehículo: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar vehículos." };
    }

    const fields = readVehicleFields(formData);
    const validationError = validateVehicleFields(fields);
    if (validationError) {
        return { error: validationError };
    }

    const { error } = await supabase.from("vehicles").update(fields).eq("id", vehicleId);

    if (error) {
        return { error: "No se pudo actualizar el vehículo: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function deleteVehicle(vehicleId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para eliminar vehículos." };
    }

    const { error } = await supabase.from("vehicles").update({ is_active: false }).eq("id", vehicleId);

    if (error) {
        return { error: "No se pudo eliminar el vehículo: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function restoreVehicle(vehicleId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para hacer esto." };
    }

    const { error } = await supabase.from("vehicles").update({ is_active: true }).eq("id", vehicleId);

    if (error) {
        return { error: "No se pudo restaurar el vehículo: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function deactivateDriver(profileId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para desactivar conductores." };
    }

    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", profileId);

    if (error) {
        return { error: "No se pudo desactivar el conductor: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function activateDriver(profileId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para hacer esto." };
    }

    const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", profileId);

    if (error) {
        return { error: "No se pudo activar el conductor: " + error.message };
    }

    revalidatePath("/admin/transports");
    return { ok: true };
}

export async function inviteDriver(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!email) {
        return { error: "Ingresá el email del conductor." };
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return { error: "El email no es válido." };
    }

    const invitationFormData = new FormData();
    invitationFormData.set("email", email);
    invitationFormData.set("role", "driver");

    const result = await createInvitation(invitationFormData);

    if (result.error) {
        return { error: result.error };
    }

    revalidatePath("/admin/transports");
    return { ok: true, link: result.link };
}
