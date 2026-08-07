"use client";

// Styles
import styles from "./clients.module.css";

// Hooks
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Data and actions
import { createClient, deleteClient, restoreClient, updateClient } from "@/modules/clients/clients.actions";
import type { Client } from "@/modules/clients/clients.dal";

// Utils
import { getClientStatus, matchesSearch } from "@/modules/clients/clients.utils";

// Components
import ClientsToolbar from "./ClientsToolBar";
import ClientsTable from "./ClientsTable";
import ClientFormModal from "./ClientFormModal";
import DeleteClientDialog from "./DeleteClientDialog";
import ClientHistoryModal from "./ClientHistoryModal";

type ClientsViewProps = {
    clients: Client[];
};

type FormModalState = {
    client: Client | null; // null = creando, Client = editando
};

export default function ClientsView({ clients }: ClientsViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // --- Filtros ---
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("Todos");

    const filteredClients = useMemo(() => {
        return clients.filter((client) => {
            if (statusFilter !== "Todos" && getClientStatus(client) !== statusFilter) return false;
            return matchesSearch(client, search.trim());
        });
    }, [clients, search, statusFilter]);

    // --- Alta / edición ---
    const [formModal, setFormModal] = useState<FormModalState | null>(null);
    const [formError, setFormError] = useState("");

    const openCreateModal = () => {
        setFormError("");
        setFormModal({ client: null });
    };

    const openEditModal = (client: Client) => {
        setFormError("");
        setFormModal({ client });
    };

    const closeFormModal = () => {
        setFormModal(null);
        setFormError("");
    };

    const handleSubmitForm = (formData: FormData) => {
        setFormError("");

        startTransition(async () => {
            const result = formModal?.client
                ? await updateClient(formModal.client.id, formData)
                : await createClient(formData);

            if (result.error) {
                setFormError(result.error);
                return;
            }

            closeFormModal();
            router.refresh();
        });
    };

    // --- Eliminar / restaurar ---
    const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
    const [deleteError, setDeleteError] = useState("");
    const [restoringIds, setRestoringIds] = useState<string[]>([]);

    const isRestoring = (client: Client) => restoringIds.includes(client.id);

    const openDeleteDialog = (client: Client) => {
        setDeleteError("");
        setDeleteTarget(client);
    };

    const closeDeleteDialog = () => {
        setDeleteTarget(null);
        setDeleteError("");
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;

        startTransition(async () => {
            const result = await deleteClient(deleteTarget.id);

            if (result.error) {
                setDeleteError(result.error);
                return;
            }

            closeDeleteDialog();
            router.refresh();
        });
    };

    const handleRestore = (client: Client) => {
        setRestoringIds((prev) => [...prev, client.id]);

        startTransition(async () => {
            await restoreClient(client.id);
            setRestoringIds((prev) => prev.filter((id) => id !== client.id));
            router.refresh();
        });
    };

    // --- Historial de pedidos ---
    const [historyClient, setHistoryClient] = useState<Client | null>(null);

    return (
        <div className={styles.container}>
            <ClientsToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onCreate={openCreateModal}
            />

            <ClientsTable
                clients={filteredClients}
                isRestoring={isRestoring}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
                onRestore={handleRestore}
                onViewHistory={setHistoryClient}
            />

            {formModal && (
                <ClientFormModal
                    client={formModal.client}
                    error={formError}
                    isPending={isPending}
                    onClose={closeFormModal}
                    onSubmit={handleSubmitForm}
                />
            )}

            {deleteTarget && (
                <DeleteClientDialog
                    client={deleteTarget}
                    error={deleteError}
                    isPending={isPending}
                    onClose={closeDeleteDialog}
                    onConfirm={confirmDelete}
                />
            )}

            {historyClient && <ClientHistoryModal client={historyClient} onClose={() => setHistoryClient(null)} />}
        </div>
    );
}