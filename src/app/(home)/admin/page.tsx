import Link from "next/link";

export default function AdminHomePage() {
    return (
        <div>
            <h1>Sos admin</h1>
            <Link href="/admin/invitations">Administrar invitaciones</Link>
        </div>
    )
}