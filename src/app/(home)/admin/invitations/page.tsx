import { redirect } from "next/navigation";
import { getServerClient } from "@/utils/supabase/getServerClient";
import InviteForm from "@/components/ui/admin/InviteForm";

export default async function InvitationsPage() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.app_metadata?.role !== "admin") {
        redirect("/admin");
    }

    const { data: invitations } = await supabase
        .from("invitations")
        .select("id, email, role, created_at, expires_at, used_at")
        .order("created_at", { ascending: false });

    return (
        <div>
            <h1>Invitaciones</h1>
            <InviteForm />

            <h2>Invitaciones enviadas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Vence</th>
                    </tr>
                </thead>
                <tbody>
                    {invitations?.map((inv) => {
                        const isExpired = !inv.used_at && new Date(inv.expires_at) < new Date();
                        const status = inv.used_at ? "Usada" : isExpired ? "Vencida" : "Pendiente";
                        return (
                            <tr key={inv.id}>
                                <td>{inv.email}</td>
                                <td>{inv.role}</td>
                                <td>{status}</td>
                                <td>{new Date(inv.expires_at).toLocaleDateString()}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}