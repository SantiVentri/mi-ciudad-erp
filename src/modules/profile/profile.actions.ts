"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { validatePassword } from "@/modules/auth/auth.utils";

type ProfileFields = {
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string;
};

export async function updateProfile(fields: ProfileFields) {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Tenés que iniciar sesión." };
    }

    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    const displayName = fields.displayName.trim();
    const phone = fields.phone.trim();

    if (!firstName || !lastName || !displayName) {
        return { error: "Completá nombre, apellido y nombre visible." };
    }

    if (phone && !/^[0-9+()\s-]{6,20}$/.test(phone)) {
        return { error: "El teléfono no es válido." };
    }

    // La política "Users can update own profile" solo deja tocar la fila propia
    const { error } = await supabase
        .from("profiles")
        .update({
            first_name: firstName,
            last_name: lastName,
            display_name: displayName,
            phone: phone || null,
        })
        .eq("id", user.id);

    if (error) {
        return { error: "No se pudo guardar el perfil: " + error.message };
    }

    revalidatePath("/driver/profile");

    return { ok: true };
}

export async function changePassword(currentPassword: string, newPassword: string) {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
        return { error: "Tenés que iniciar sesión." };
    }

    if (!currentPassword) {
        return { error: "Ingresá tu contraseña actual." };
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
        return { error: passwordError };
    }

    if (currentPassword === newPassword) {
        return { error: "La contraseña nueva tiene que ser distinta de la actual." };
    }

    // Se confirma la contraseña actual antes de cambiarla
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
    });

    if (signInError) {
        return { error: "La contraseña actual no es correcta." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
        return { error: "No se pudo cambiar la contraseña: " + error.message };
    }

    return { ok: true };
}
