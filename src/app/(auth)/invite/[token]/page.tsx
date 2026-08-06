// Styles
import styles from "./invite.module.css";

// Components
import RegisterForm from "@/components/auth/forms/RegisterForm";

// Utils
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
        <div className={styles.container}>
            <main>
                <div className={styles.titles}>
                    <h1>Completá tu perfil</h1>
                    <p>Ingresá tus datos para crear tu cuenta</p>
                </div>
                <RegisterForm email={data.email} token={token} />
            </main>
            <aside />
        </div>
    )
}