// Styles
import Image from "next/image";
import styles from "./login.module.css";

// Components
import LoginForm from "@/components/auth/forms/LoginForm";

export default function RegisterPage() {
    const backgroundImage = "/auth/AuthBG.jpg";
    return (
        <div className={styles.container}>
            <main>
                <div className={styles.titles}>
                    <h1>Iniciar sesión</h1>
                    <p>Ingresá tu mail y contraseña para acceder a tu cuenta</p>
                </div>
                <LoginForm />
            </main>
            <aside>
                <Image
                    src={backgroundImage}
                    className={styles.image}
                    height={900}
                    width={900}
                    alt="auth background"
                    priority
                />
            </aside>
        </div>
    )
}