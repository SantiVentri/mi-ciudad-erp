// Reglas de contraseña compartidas entre el registro y el cambio de contraseña
export function validatePassword(password: string) {
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (password.length > 20) return "La contraseña no puede tener más de 20 caracteres.";
    if (!/[A-Z]/.test(password)) return "La contraseña debe tener al menos una mayúscula.";
    if (!/[a-z]/.test(password)) return "La contraseña debe tener al menos una minúscula.";
    if (!/[0-9]/.test(password)) return "La contraseña debe tener al menos un número.";
    return null;
}
