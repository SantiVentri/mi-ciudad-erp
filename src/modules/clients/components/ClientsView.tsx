"use client";

// Styles
import styles from "./clients.module.css";

// Hooks
import { useEffect, useMemo, useState, useTransition } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";
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
import DeleteClientDialog from "./DisableClientDialog";
import ClientHistoryModal from "./ClientHistoryModal";
import PaginationControl from "@/components/ui/admin/pagination/PaginationControl";

type ClientsViewProps = {
    clients: Client[];
    // Cliente a mostrar al entrar (viene de ?cliente=<id>)
    focusClientId?: string;
};

type FormModalState = {
    client: Client | null; // null = creando, Client = editando
};

const ROWS_PER_PAGE = 10;

export default function ClientsView({ clients, focusClientId }: ClientsViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Al entrar sin filtros la tabla muestra todos los clientes en este orden,
    // así que la página del cliente enfocado sale de su posición en la lista
    const focusIndex = clients.findIndex((client) => client.id === focusClientId);
    const [currentPage, setCurrentPage] = useState(() =>
        focusIndex >= 0 ? Math.floor(focusIndex / ROWS_PER_PAGE) + 1 : 1,
    );
    const focusedId = focusIndex >= 0 ? clients[focusIndex].id : undefined;
    const [highlightedId, setHighlightedId] = useState(focusedId);

    // Lleva la vista hasta el cliente enfocado (solo al entrar, no en cada refresh)
    useEffect(() => {
        if (!focusedId) return;
        document
            .getElementById(`cliente-${focusedId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusedId]);

    // --- Filtros ---
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("Todos");

    // Al filtrar se vuelve a la primera página y se apaga el resaltado para que no se repita
    useResetOnChange([search, statusFilter], () => {
        setCurrentPage(1);
        setHighlightedId(undefined);
    });

    const filteredClients = useMemo(() => {
        return clients.filter((client) => {
            if (statusFilter !== "Todos" && getClientStatus(client) !== statusFilter) return false;
            return matchesSearch(client, search.trim());
        });
    }, [clients, search, statusFilter]);

    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const totalPages = Math.ceil(filteredClients.length / ROWS_PER_PAGE) || 1;

    const paginatedClients = useMemo(() => {
        return filteredClients.slice(startIndex, startIndex + ROWS_PER_PAGE);
    }, [filteredClients, startIndex]);

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
                clients={paginatedClients}
                highlightedId={highlightedId}
                isRestoring={isRestoring}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
                onRestore={handleRestore}
                onViewHistory={setHistoryClient}
            />

            {filteredClients.length > ROWS_PER_PAGE && (
                <>
                    <span>
                        Resultados {filteredClients.length === 0 ? 0 : startIndex + 1} -{" "}
                        {Math.min(startIndex + ROWS_PER_PAGE, filteredClients.length)} de {filteredClients.length}
                    </span>

                    <PaginationControl
                        currentPage={currentPage}
                        setCurrentPage={(page) => {
                            setCurrentPage(page);
                            setHighlightedId(undefined);
                        }}
                        totalPages={totalPages}
                    />
                </>
            )}

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