// Styles
import "./layout.module.css";

// Componetns
import AdminSideNav from "@/components/layout/nav/AdminSideNav"

// Hooks
import { getProfile } from "@/modules/users/users.dal";
import requireAdmin from "@/utils/auth/requireAdmin";
import { redirect } from "next/navigation";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const profile = await getProfile()

    if (!profile) {
        redirect("/login")
    }

    const supabase = await requireAdmin();
    if (!supabase) {
        redirect("/driver")
    }

    return (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <AdminSideNav
                name={profile.name}
                email={profile.email}
                avatarUrl={profile.avatarUrl ?? ""}
            />
            <main
                style={{
                    flex: 1,
                    padding: "2rem",
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    backgroundColor: "#f5f5f5",
                }}
            >
                {children}
            </main>
        </div>
    )
}