"use server";

import { getServerClient } from "@/utils/supabase/getServerClient";
import { validatePassword } from "@/modules/auth/auth.utils";

type RegisterFields = {
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    password: string;
    token?: string;
};

function validateFields(fields: RegisterFields) {
    const { email, displayName, firstName, lastName, password } = fields;

    if (!email || !displayName || !firstName || !lastName || !password) {
        return "Completá todos los campos.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "El email no es válido.";
    }

    return validatePassword(password);
}

export async function registerUser(fields: RegisterFields) {
    const validationError = validateFields(fields);
    if (validationError) {
        return { error: validationError };
    }

    const supabase = await getServerClient();

    const { error: signUpError } = await supabase.auth.signUp({
        email: fields.email,
        password: fields.password,
        options: {
            data: {
                display_name: fields.displayName,
                first_name: fields.firstName,
                last_name: fields.lastName,
                ...(fields.token ? { invite_token: fields.token } : {}),
            },
        },
    });

    if (signUpError) {
        return { error: "No se pudo crear la cuenta: " + signUpError.message };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: fields.email,
        password: fields.password,
    });

    if (signInError) {
        return { error: "Cuenta creada, pero no se pudo iniciar sesión automáticamente. Andá a /login." };
    }

    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role;

    return { ok: true, redirectTo: role === "driver" ? "/driver" : "/admin/routes" };
}