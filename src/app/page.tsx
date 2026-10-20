import { redirect } from "next/navigation";

// "/" no tiene contenido: el proxy ya manda a cada usuario a su inicio
// (o al login si no hay sesión); esto queda como respaldo.
export default function Home() {
  redirect("/login");
}
