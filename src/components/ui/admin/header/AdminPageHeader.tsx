import styles from "./adminPageHeader.module.css";

type AdminPageHeaderProps = {
    title: string;
    description?: string;
    children?: React.ReactNode;
};

export default function AdminPageHeader({
    title,
    description,
    children,
}: AdminPageHeaderProps) {
    return (
        <header className={styles.header}>
            <div className={styles.texts}>
                <h1 className={styles.title}>{title}</h1>
                {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            {children ? <div className={styles.actions}>{children}</div> : null}
        </header>
    );
}