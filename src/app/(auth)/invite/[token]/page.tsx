import RegisterForm from "@/components/auth/forms/RegisterForm";
import { getServerClient } from "@/utils/supabase/getServerClient";

type InvitationValidation = {
    email: string;
    role: string;
    is_valid: boolean;
};

export default async function InvitePage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const supabase = await getServerClient();

    const { data, error } = await supabase
        .rpc("validate_invitation", { p_token: token })
        .maybeSingle()
        .overrideTypes<InvitationValidation, { merge: false }>();

    if (error || !data || !data.is_valid) {
        return (
            <div>
                <h1>Invitación inválida</h1>
                <p>
                    Este link venció, ya fue usado, o no existe. Pedile a un
                    administrador que te envíe uno nuevo.
                </p>
            </div>
        );
    }

    return (
        <div>
            <h1>Crear cuenta</h1>
            <p>Te invitaron con el email <strong>{data.email}</strong></p>
            <RegisterForm email={data.email} token={token} />
        </div>
    );
}