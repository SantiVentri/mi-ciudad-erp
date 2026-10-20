import { redirect } from "next/navigation";

// El módulo de rutas es la pantalla inicial del admin
export default function AdminHomePage() {
    redirect("/admin/routes");
}
