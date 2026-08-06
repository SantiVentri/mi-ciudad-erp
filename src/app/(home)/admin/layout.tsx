import AdminSideNav from "@/components/ui/admin/nav/AdminSideNav"
import { getProfile } from "@/modules/users/users.dal";
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

    return (
        <div style={{ display: "flex", height: "100vh" }}>
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
                    backgroundColor: "#f5f5f5",
                }}
            >
                {children}
            </main>
        </div>
    )
}