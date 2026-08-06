"use client";

// Styles
import styles from "./nav.module.css";

// Hooks
import { usePathname } from "next/navigation";

// Components
import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/auth/signOutButton/SignOutButton";

// Icons
import { Home, Package, Route, Truck, Users } from "lucide-react";

type NavProps = {
    avatarUrl?: string;
    name?: string;
    email?: string;
}

export default function AdminSideNav({
    avatarUrl,
    name,
    email
}: NavProps) {
    const pathname = usePathname();

    // Navigation links
    const NavLinks = [
        {
            href: "/admin",
            label: "Inicio",
            icon: <Home />
        },
        {
            href: "/admin/routes",
            label: "Rutas",
            icon: <Route />
        },
        {
            href: "/admin/clients",
            label: "Clientes",
            icon: <Users />
        },
        {
            href: "/admin/orders",
            label: "Pedidos",
            icon: <Package />
        },
        {
            href: "/admin/transports",
            label: "Vehículos y conductores",
            icon: <Truck />
        }
    ]

    const isActiveRoute = (href: string) => {
        if (href === "/admin") {
            return pathname === href;
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    }

    return (
        <div className={styles.navContainer}>
            <nav className={styles.nav}>
                <div className={styles.logo}>
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={50}
                        height={50}
                        draggable={false}
                    />
                </div>
                {NavLinks.map((link, index) => (
                    <Link
                        key={index}
                        href={link.href}
                        aria-current={isActiveRoute(link.href) ? "page" : undefined}
                        className={`${styles.navLink} ${isActiveRoute(link.href) ? styles.isActive : ""}`}
                    >
                        {link.icon}
                        {link.label}
                    </Link>
                ))}
            </nav>
            <div className={styles.navFooter}>
                <div className={styles.userInfo}>
                    <Image
                        src={avatarUrl || "https://placehold.co/100/3454d1/ffffff?text=MC"}
                        alt="User Avatar"
                        width={45}
                        height={45}
                        className={styles.avatar}
                        draggable={false}
                        unoptimized
                    />
                    <div className={styles.names}>
                        <p className={styles.name}>{name || "Usuario"}</p>
                        <p className={styles.email}>{email || "santino.ventrice@ejemplo.com"}</p>
                    </div>
                </div>
                <SignOutButton />
            </div>
        </div>
    )
}