export type VehicleFormValues = {
    patent: string;
};

export type DriverInviteFormValues = {
    email: string;
};

export type Driver = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    is_active: boolean;
}