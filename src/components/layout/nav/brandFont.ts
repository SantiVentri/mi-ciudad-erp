import { Poppins } from "next/font/google";

// Fuente del nombre de la marca en el menú lateral (el resto de la app usa Inter)
export const brandFont = Poppins({
    subsets: ["latin"],
    weight: ["700"],
    display: "swap",
});
