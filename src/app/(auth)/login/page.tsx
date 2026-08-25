// Styles
import styles from "./login.module.css";

// Components
import LoginForm from "@/modules/auth/components/forms/LoginForm";

export default function RegisterPage() {
    return (
        <div className={styles.container}>
            <main>
                <div className={styles.titles}>
                    <h1>Iniciar sesión</h1>
                    <p>Ingresá tu mail y contraseña para acceder a tu cuenta</p>
                </div>
                <LoginForm />
            </main>
            <aside />
        </div>
    )
}