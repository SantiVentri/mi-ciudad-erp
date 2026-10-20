"use client";

// Styles
import styles from "./profile.module.css";

// Hooks
import { useState, useTransition, type FormEvent } from "react";

// Actions
import { changePassword, updateProfile } from "@/modules/profile/profile.actions";

// Components
import Image from "next/image";
import SignOutButton from "@/modules/auth/components/signOutButton/SignOutButton";

// Types
import type { DriverProfile } from "@/modules/profile/profile.dal";

// Icons
import { CheckCircle2, Mail, Phone, Route, XCircle } from "lucide-react";

type ProfileViewProps = {
    profile: DriverProfile;
};

type Feedback = { kind: "error" | "success"; message: string } | null;

function getInitials(profile: DriverProfile) {
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`;
    return initials.toUpperCase() || "MC";
}

function formatMemberSince(value: string) {
    return new Date(value).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default function ProfileView({ profile }: ProfileViewProps) {
    const fullName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || profile.displayName;

    // --- Datos personales ---
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState(profile.firstName ?? "");
    const [lastName, setLastName] = useState(profile.lastName ?? "");
    const [displayName, setDisplayName] = useState(profile.displayName ?? "");
    const [phone, setPhone] = useState(profile.phone ?? "");
    const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
    const [isSavingProfile, startProfileTransition] = useTransition();

    const cancelEdit = () => {
        setFirstName(profile.firstName ?? "");
        setLastName(profile.lastName ?? "");
        setDisplayName(profile.displayName ?? "");
        setPhone(profile.phone ?? "");
        setProfileFeedback(null);
        setIsEditing(false);
    };

    const handleSaveProfile = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setProfileFeedback(null);

        startProfileTransition(async () => {
            const result = await updateProfile({ firstName, lastName, displayName, phone });
            if (result.error) {
                setProfileFeedback({ kind: "error", message: result.error });
                return;
            }
            setProfileFeedback({ kind: "success", message: "Datos guardados." });
            setIsEditing(false);
        });
    };

    // --- Contraseña ---
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
    const [isSavingPassword, startPasswordTransition] = useTransition();

    const resetPasswordForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const handleChangePassword = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordFeedback(null);

        if (newPassword !== confirmPassword) {
            setPasswordFeedback({ kind: "error", message: "Las contraseñas nuevas no coinciden." });
            return;
        }

        startPasswordTransition(async () => {
            const result = await changePassword(currentPassword, newPassword);
            if (result.error) {
                setPasswordFeedback({ kind: "error", message: result.error });
                return;
            }
            resetPasswordForm();
            setIsChangingPassword(false);
            setPasswordFeedback({ kind: "success", message: "Contraseña actualizada." });
        });
    };

    return (
        <div className={styles.content}>
            {/* --- Tarjeta principal --- */}
            <section className={styles.card}>
                <div className={styles.identity}>
                    {profile.avatar ? (
                        <Image
                            src={profile.avatar}
                            alt={fullName}
                            width={72}
                            height={72}
                            className={styles.avatar}
                            unoptimized
                        />
                    ) : (
                        <span className={styles.avatarFallback}>{getInitials(profile)}</span>
                    )}
                    <div className={styles.identityText}>
                        <h2>{fullName}</h2>
                        <p className={styles.muted}>@{profile.displayName}</p>
                        <span className={styles.roleBadge}>Conductor</span>
                    </div>
                </div>

                <ul className={styles.contactList}>
                    <li>
                        <Mail size={16} />
                        {profile.email}
                    </li>
                    <li>
                        <Phone size={16} />
                        {profile.phone || <span className={styles.muted}>Sin teléfono cargado</span>}
                    </li>
                </ul>

                <p className={styles.memberSince}>
                    En Mi Ciudad desde {formatMemberSince(profile.memberSince)}
                </p>
            </section>

            {/* --- Estadísticas --- */}
            <section className={styles.stats}>
                <div className={styles.stat}>
                    <Route size={18} />
                    <strong>{profile.stats.completedRoutes}</strong>
                    <span>Rutas completadas</span>
                </div>
                <div className={styles.stat}>
                    <CheckCircle2 size={18} />
                    <strong>{profile.stats.deliveredStops}</strong>
                    <span>Entregas realizadas</span>
                </div>
                <div className={`${styles.stat} ${styles.statDanger}`}>
                    <XCircle size={18} />
                    <strong>{profile.stats.failedStops}</strong>
                    <span>Entregas fallidas</span>
                </div>
            </section>

            {/* --- Datos personales --- */}
            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <h3>Datos personales</h3>
                    {!isEditing && (
                        <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => {
                                setProfileFeedback(null);
                                setIsEditing(true);
                            }}
                        >
                            Editar
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form className={styles.form} onSubmit={handleSaveProfile}>
                        <label className={styles.field}>
                            Nombre
                            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            Apellido
                            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            Nombre visible
                            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            Teléfono
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="11 1234-5678"
                            />
                        </label>

                        {profileFeedback?.kind === "error" && (
                            <p className={styles.error}>{profileFeedback.message}</p>
                        )}

                        <div className={styles.actions}>
                            <button type="button" className={styles.secondaryButton} onClick={cancelEdit}>
                                Cancelar
                            </button>
                            <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
                                {isSavingProfile ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <dl className={styles.details}>
                            <div>
                                <dt>Nombre</dt>
                                <dd>{profile.firstName}</dd>
                            </div>
                            <div>
                                <dt>Apellido</dt>
                                <dd>{profile.lastName}</dd>
                            </div>
                            <div>
                                <dt>Nombre visible</dt>
                                <dd>{profile.displayName}</dd>
                            </div>
                            <div>
                                <dt>Teléfono</dt>
                                <dd>{profile.phone || "—"}</dd>
                            </div>
                        </dl>
                        {profileFeedback?.kind === "success" && (
                            <p className={styles.success}>{profileFeedback.message}</p>
                        )}
                    </>
                )}
            </section>

            {/* --- Seguridad --- */}
            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <h3>Seguridad</h3>
                    {!isChangingPassword && (
                        <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => {
                                setPasswordFeedback(null);
                                setIsChangingPassword(true);
                            }}
                        >
                            Cambiar contraseña
                        </button>
                    )}
                </div>

                {isChangingPassword ? (
                    <form className={styles.form} onSubmit={handleChangePassword}>
                        <label className={styles.field}>
                            Contraseña actual
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </label>
                        <label className={styles.field}>
                            Contraseña nueva
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </label>
                        <label className={styles.field}>
                            Repetí la contraseña nueva
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </label>
                        <p className={styles.hint}>
                            Entre 6 y 20 caracteres, con al menos una mayúscula, una minúscula y un número.
                        </p>

                        {passwordFeedback?.kind === "error" && (
                            <p className={styles.error}>{passwordFeedback.message}</p>
                        )}

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => {
                                    resetPasswordForm();
                                    setPasswordFeedback(null);
                                    setIsChangingPassword(false);
                                }}
                            >
                                Cancelar
                            </button>
                            <button type="submit" className={styles.primaryButton} disabled={isSavingPassword}>
                                {isSavingPassword ? "Guardando..." : "Cambiar"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className={passwordFeedback?.kind === "success" ? styles.success : styles.muted}>
                        {passwordFeedback?.kind === "success"
                            ? passwordFeedback.message
                            : "Usá una contraseña que no uses en otros sitios."}
                    </p>
                )}
            </section>

            <div className={styles.signOut}>
                <SignOutButton showLabel />
            </div>
        </div>
    );
}
