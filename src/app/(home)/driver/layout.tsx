// Styles
import styles from "./layout.module.css";

// Components
import DriverNav from "@/components/ui/driver/nav/DriverNav";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={styles.container}>
            <main>
                {children}
            </main>
            <DriverNav />
        </div>
    )
}