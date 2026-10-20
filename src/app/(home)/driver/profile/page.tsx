// Styles
import styles from "./profile.module.css";

// Components
import ProfileView from "@/modules/profile/components/ProfileView";

// Data
import { getDriverProfile } from "@/modules/profile/profile.dal";

export const metadata = {
    title: "Perfil",
};

export default async function DriverProfilePage() {
    const profile = await getDriverProfile();

    return (
        <div className={styles.container}>
            {profile ? (
                <ProfileView profile={profile} />
            ) : (
                <p className={styles.error}>No se pudo cargar tu perfil. Probá recargar la página.</p>
            )}
        </div>
    );
}
