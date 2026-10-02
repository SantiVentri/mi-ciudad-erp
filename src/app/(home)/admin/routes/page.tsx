import AdminPageHeader from "@/components/layout/header/AdminPageHeader";

export const metadata = {
  title: "Rutas",
  description:
    "Visualizá y organizá las rutas disponibles para la operación diaria.",
};

export default function RoutesPage() {
  return (
    <div>
      <AdminPageHeader
        title="Rutas"
        description="Visualizá y organizá las rutas disponibles para la operación diaria."
      />
    </div>
  );
}
