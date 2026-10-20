"use client";

// Styles
import styles from "./invitations.module.css";

// Hooks
import { useState } from "react";

// Components
import InviteUserModal from "./InviteUserModal";

// Icons
import { UserPlus } from "lucide-react";

export default function InviteUserButton() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={styles.inviteIconButton}
                onClick={() => setIsOpen(true)}
                title="Invitar usuario"
                aria-label="Invitar usuario"
            >
                <UserPlus size={20} />
            </button>

            {isOpen && <InviteUserModal onClose={() => setIsOpen(false)} />}
        </>
    );
}
