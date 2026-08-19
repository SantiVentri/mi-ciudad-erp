"use client";

// Styles
import styles from "./transports.module.css";

// Hooks
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Data and actions
import {
    activateDriver,
    createVehicle,
    deactivateDriver,
    deleteVehicle,
    inviteDriver,
    restoreVehicle,
    updateVehicle,
} from "@/modules/transports/transports.actions";
import type { Driver, RouteAssignment, Vehicle } from "@/modules/transports/transports.dal";

// Utils
import { buildAssignmentMaps, getVehicleStatus, matchesVehicleSearch, getDriverStatus, matchesDriverSearch } from "@/modules/transports/transports.utils";

// Components
import VehiclesToolbar from "./VehiclesToolbar";
import VehiclesTable from "./VehiclesTable";
import VehicleFormModal from "./VehicleFormModal";
import DeleteVehicleDialog from "./DisableVehicleDialog";
import DriversToolbar from "./DriversToolbar";
import DriversTable from "./DriversTable";
import DriverInviteModal from "./DriverInviteModal";

// Icons
import { Truck, Users } from "lucide-react";

type TransportsViewProps = {
    vehicles: Vehicle[];
    drivers: Driver[];
    assignments: RouteAssignment[];
};

type VehicleFormModalState = {
    vehicle: Vehicle | null; // null = creando, Vehicle = editando
};

export default function TransportsView({ vehicles, drivers, assignments }: TransportsViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const assignmentMaps = useMemo(() => buildAssignmentMaps(assignments), [assignments]);

    // --- Sección activa ---
    const [activeTab, setActiveTab] = useState<"vehiculos" | "conductores">("vehiculos");

    // ===== Vehículos =====
    const [vehicleSearch, setVehicleSearch] = useState("");
    const [vehicleStatusFilter, setVehicleStatusFilter] = useState("Todos");

    const filteredVehicles = useMemo(() => {
        return vehicles.filter((vehicle) => {
            if (vehicleStatusFilter !== "Todos" && getVehicleStatus(vehicle) !== vehicleStatusFilter) return false;
            return matchesVehicleSearch(vehicle, vehicleSearch.trim());
        });
    }, [vehicles, vehicleSearch, vehicleStatusFilter]);

    const [vehicleFormModal, setVehicleFormModal] = useState<VehicleFormModalState | null>(null);
    const [vehicleFormError, setVehicleFormError] = useState("");

    const openCreateVehicleModal = () => {
        setVehicleFormError("");
        setVehicleFormModal({ vehicle: null });
    };

    const openEditVehicleModal = (vehicle: Vehicle) => {
        setVehicleFormError("");
        setVehicleFormModal({ vehicle });
    };

    const closeVehicleFormModal = () => {
        setVehicleFormModal(null);
        setVehicleFormError("");
    };

    const handleSubmitVehicleForm = (formData: FormData) => {
        setVehicleFormError("");

        startTransition(async () => {
            const result = vehicleFormModal?.vehicle
                ? await updateVehicle(vehicleFormModal.vehicle.id, formData)
                : await createVehicle(formData);

            if (result.error) {
                setVehicleFormError(result.error);
                return;
            }

            closeVehicleFormModal();
            router.refresh();
        });
    };

    const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
    const [deleteError, setDeleteError] = useState("");
    const [restoringIds, setRestoringIds] = useState<string[]>([]);

    const isRestoringVehicle = (vehicle: Vehicle) => restoringIds.includes(vehicle.id);

    const openDeleteDialog = (vehicle: Vehicle) => {
        setDeleteError("");
        setDeleteTarget(vehicle);
    };

    const closeDeleteDialog = () => {
        setDeleteTarget(null);
        setDeleteError("");
    };

    const confirmDeleteVehicle = () => {
        if (!deleteTarget) return;

        startTransition(async () => {
            const result = await deleteVehicle(deleteTarget.id);

            if (result.error) {
                setDeleteError(result.error);
                return;
            }

            closeDeleteDialog();
            router.refresh();
        });
    };

    const handleRestoreVehicle = (vehicle: Vehicle) => {
        setRestoringIds((prev) => [...prev, vehicle.id]);

        startTransition(async () => {
            await restoreVehicle(vehicle.id);
            setRestoringIds((prev) => prev.filter((id) => id !== vehicle.id));
            router.refresh();
        });
    };

    // ===== Conductores =====
    const [driverSearch, setDriverSearch] = useState("");
    const [driverStatusFilter, setDriverStatusFilter] = useState("Todos");

    const filteredDrivers = useMemo(() => {
        return drivers.filter((driver) => {
            if (driverStatusFilter !== "Todos" && getDriverStatus(driver) !== driverStatusFilter) return false;
            return matchesDriverSearch(driver, driverSearch.trim());
        });
    }, [drivers, driverSearch, driverStatusFilter]);

    const [togglingDriverIds, setTogglingDriverIds] = useState<string[]>([]);

    const isTogglingDriver = (driver: Driver) => togglingDriverIds.includes(driver.id);

    const handleDeactivateDriver = (driver: Driver) => {
        if (!driver.profile) return;
        const profileId = driver.profile.id;

        setTogglingDriverIds((prev) => [...prev, driver.id]);

        startTransition(async () => {
            await deactivateDriver(profileId);
            setTogglingDriverIds((prev) => prev.filter((id) => id !== driver.id));
            router.refresh();
        });
    };

    const handleActivateDriver = (driver: Driver) => {
        if (!driver.profile) return;
        const profileId = driver.profile.id;

        setTogglingDriverIds((prev) => [...prev, driver.id]);

        startTransition(async () => {
            await activateDriver(profileId);
            setTogglingDriverIds((prev) => prev.filter((id) => id !== driver.id));
            router.refresh();
        });
    };

    const [driverInviteModalOpen, setDriverInviteModalOpen] = useState(false);
    const [driverInviteError, setDriverInviteError] = useState("");
    const [driverInviteLink, setDriverInviteLink] = useState("");

    const openDriverInviteModal = () => {
        setDriverInviteError("");
        setDriverInviteLink("");
        setDriverInviteModalOpen(true);
    };

    const closeDriverInviteModal = () => {
        setDriverInviteModalOpen(false);
        setDriverInviteError("");
        setDriverInviteLink("");
    };

    const handleSubmitDriverInvite = (formData: FormData) => {
        setDriverInviteError("");

        startTransition(async () => {
            const result = await inviteDriver(formData);

            if (result.error) {
                setDriverInviteError(result.error);
                return;
            }

            setDriverInviteLink(result.link ?? "");
            router.refresh();
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.sectionTabs}>
                <button
                    type="button"
                    className={`${styles.sectionTab} ${activeTab === "vehiculos" ? styles.sectionTabActive : ""}`}
                    onClick={() => setActiveTab("vehiculos")}
                >
                    <Truck size={16} />
                    Vehículos
                    <span className={styles.sectionTabCount}>{vehicles.length}</span>
                </button>
                <button
                    type="button"
                    className={`${styles.sectionTab} ${activeTab === "conductores" ? styles.sectionTabActive : ""}`}
                    onClick={() => setActiveTab("conductores")}
                >
                    <Users size={16} />
                    Conductores
                    <span className={styles.sectionTabCount}>{drivers.length}</span>
                </button>
            </div>

            {activeTab === "vehiculos" ? (
                <>
                    <VehiclesToolbar
                        search={vehicleSearch}
                        onSearchChange={setVehicleSearch}
                        statusFilter={vehicleStatusFilter}
                        onStatusFilterChange={setVehicleStatusFilter}
                        onCreate={openCreateVehicleModal}
                    />

                    <VehiclesTable
                        vehicles={filteredVehicles}
                        drivers={drivers}
                        assignmentMaps={assignmentMaps}
                        isRestoring={isRestoringVehicle}
                        onEdit={openEditVehicleModal}
                        onDelete={openDeleteDialog}
                        onRestore={handleRestoreVehicle}
                    />
                </>
            ) : (
                <>
                    <DriversToolbar
                        search={driverSearch}
                        onSearchChange={setDriverSearch}
                        statusFilter={driverStatusFilter}
                        onStatusFilterChange={setDriverStatusFilter}
                        onCreate={openDriverInviteModal}
                    />

                    <DriversTable
                        drivers={filteredDrivers}
                        vehicles={vehicles}
                        assignmentMaps={assignmentMaps}
                        isToggling={isTogglingDriver}
                        onDeactivate={handleDeactivateDriver}
                        onActivate={handleActivateDriver}
                    />
                </>
            )}

            {vehicleFormModal && (
                <VehicleFormModal
                    vehicle={vehicleFormModal.vehicle}
                    error={vehicleFormError}
                    isPending={isPending}
                    onClose={closeVehicleFormModal}
                    onSubmit={handleSubmitVehicleForm}
                />
            )}

            {deleteTarget && (
                <DeleteVehicleDialog
                    vehicle={deleteTarget}
                    error={deleteError}
                    isPending={isPending}
                    onClose={closeDeleteDialog}
                    onConfirm={confirmDeleteVehicle}
                />
            )}

            {driverInviteModalOpen && (
                <DriverInviteModal
                    error={driverInviteError}
                    link={driverInviteLink}
                    isPending={isPending}
                    onClose={closeDriverInviteModal}
                    onSubmit={handleSubmitDriverInvite}
                />
            )}
        </div>
    );
}
