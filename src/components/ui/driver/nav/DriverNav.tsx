"use client";

// Styles
import styles from "./nav.module.css";

// Hooks
import { usePathname } from "next/navigation";

// Components
import Link from "next/link";

// Icons
import { Route, History, Bell, User } from "lucide-react";

export default function DriverNav() {
    const pathname = usePathname();

    const navItems = [
        {
            label: "Rutas",
            icon: <Route />,
            href: "/driver"
        },
        {
            label: "Historial",
            icon: <History />,
            href: "/driver/history"
        },
        {
            label: "Avisos",
            icon: <Bell />,
            href: "/driver/notifications"
        },
        {
            label: "Perfil",
            icon: <User />,
            href: "/driver/profile"
        }
    ]

    const isActiveRoute = (href: string) => {
        if (href === "/driver") {
            return pathname === href;
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    }

    return (
        <nav className={styles.nav}>
            {navItems.map((item, index) => (
                <Link key={index} href={item.href} className={`${styles.navItem} ${isActiveRoute(item.href) ? styles.active : ""}`}>
                    {item.icon}
                    <p>{item.label}</p>
                </Link>
            ))}
        </nav>
    )
}