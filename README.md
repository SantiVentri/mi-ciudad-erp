# Mi Ciudad ERP

Sistema de gestión para la distribución de **Embotelladora Mi Ciudad**: pedidos, clientes, vehículos y armado de rutas de reparto, con una vista móvil para que los choferes sigan su recorrido del día.

Tiene dos tipos de usuario:

- **Admin**: gestiona pedidos, clientes, transportes e invitaciones, y arma las rutas de reparto.
- **Chofer**: ve las rutas que tiene asignadas, navega entre paradas y marca cada entrega.

## Screenshots

| Admin: métricas de rutas | Admin: ruta y paradas |
|---|---|
| <img width="1908" height="870" alt="admin routes metrics" src="https://github.com/user-attachments/assets/50f247cd-6582-4175-b64b-84a886a5b07c" /> | <img width="1908" height="870" alt="admin routes" src="https://github.com/user-attachments/assets/6e8124cc-122c-46d1-9a82-98a11b4c03a7" /> |

| Admin: pedidos | Admin: vehículos y conductores |
|---|---|
| <img width="1908" height="870" alt="admin orders" src="https://github.com/user-attachments/assets/98f1e1ea-f4e0-4ac1-b71c-2c646405e44a" /> | <img width="1908" height="870" alt="admin transports" src="https://github.com/user-attachments/assets/628eef8c-b787-4f9e-9b3c-6be2a6161fd2" /> |

| Chofer: ruta del día | Chofer: gestión de paradas |
|---|---|
| <img height="400" alt="driver route" src="https://github.com/user-attachments/assets/521c01b4-d94f-41c7-a415-ea64d2f97cf9" /> | <img height="400" alt="driver stops" src="https://github.com/user-attachments/assets/8530aca2-d54a-4651-8faa-78a2cce67c21" /> |

## Funcionalidades

### Admin

- **Rutas**: generación de rutas por día y vuelta (hasta 2 por día), con el orden de paradas optimizado y el recorrido por calles dibujado en el mapa. Las rutas se pueden editar y asignar a un chofer y un vehículo.
- **Pedidos**: alta de pedidos con detalle de productos, filtros por día y estado (`Pendiente`, `Asignada`, `Completada`, `Cancelada`), cambio de fecha y métricas de crecimiento.
- **Clientes**: ABM de clientes con geocodificación automática de la dirección, historial de pedidos y ranking de los que más compran.
- **Transportes**: listado de choferes y vehículos con sus métricas.
- **Invitaciones**: alta de usuarios nuevos por link de invitación, con su rol.

### Chofer

- Rutas del día con sus paradas y el mapa del recorrido.
- Link a Google Maps que sale de la distribuidora o de la última parada visitada.
- Cambio de estado de cada parada (`Completada`, `Entrega fallida`).
- Historial de rutas, notificaciones y perfil.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + React 19 + TypeScript
- [Supabase](https://supabase.com): Auth, Postgres, RPCs y Row Level Security
- [Leaflet](https://leafletjs.com) / react-leaflet con tiles de OpenStreetMap
- [OpenRouteService](https://openrouteservice.org): optimización del orden de paradas (VROOM) y trazado por calles
- [Nominatim](https://nominatim.org): geocodificación de las direcciones de los clientes
- CSS Modules y [lucide-react](https://lucide.dev) para íconos

## Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase (o la [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) con Docker para correrlo en local)
- Una API key gratuita de [OpenRouteService](https://openrouteservice.org/dev/#/signup)

## Puesta en marcha

```bash
git clone https://github.com/SantiVentri/mi-ciudad-erp.git
cd mi-ciudad-erp
npm install
```

1. Copiá `.env.example` a `.env.development` (o `.env.local`) y completá las variables (ver [Variables de entorno](#variables-de-entorno)).
2. Aplicá las migraciones a la base:

   ```bash
   # Contra un proyecto remoto
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push

   # O en local (necesita Docker)
   npx supabase start
   ```

3. Levantá el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abrí [http://localhost:3000](http://localhost:3000).

### Crear el primer admin

El registro solo funciona con una invitación válida, así que el primer admin se crea a mano. Desde el SQL Editor de Supabase:

```sql
insert into public.invitations (email, role)
values ('tu-email@dominio.com', 'admin')
returning id;
```

Después entrá a `http://localhost:3000/invite/<id>` y completá el registro. A partir de ahí, los demás usuarios se invitan desde **Admin › Invitaciones**.

## Variables de entorno

| Variable | Alcance | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | cliente | URL pública de la app. Se usa para armar los links de invitación. |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente | Key pública (publishable) de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Key con permisos totales. Nunca le pongas el prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_COMPANY_ADDRESS` | cliente | Dirección de la embotelladora que se muestra en las rutas. |
| `NEXT_PUBLIC_DEPOT_LATITUDE` | cliente | Latitud del punto de salida y regreso de las rutas. |
| `NEXT_PUBLIC_DEPOT_LONGITUDE` | cliente | Longitud del punto de salida y regreso de las rutas. |
| `ORS_API_KEY` | **solo servidor** | API key de OpenRouteService. |
| `NOMINATIM_USER_AGENT` | **solo servidor** | User-Agent con un contacto, como pide Nominatim. Ej: `MiCiudadERP/1.0 (tu-email@dominio.com)`. |
| `ALLOWED_DEV_ORIGINS` | dev | Orígenes extra permitidos en `next dev`, separados por coma (útil para probar desde el celular en la red local). |

Las coordenadas del depósito se pueden sacar de Google Maps haciendo clic derecho sobre el punto y copiando las coordenadas.

> Si falta `ORS_API_KEY` o la API de OpenRouteService falla, las paradas se ordenan localmente para no bloquear el armado de rutas.

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/           # login e invite/[token]
│   └── (home)/
│       ├── admin/        # clients, orders, routes, transports, invitations
│       └── driver/       # inicio, routes/[routeId], history, notifications, profile
├── modules/              # lógica por dominio
│   └── <dominio>/
│       ├── *.actions.ts  # Server Actions
│       ├── *.dal.ts      # acceso a datos (consultas a Supabase)
│       ├── *.types.ts
│       ├── *.constants.ts
│       ├── *.utils.ts
│       └── components/   # componentes propios del dominio
├── components/           # layout (header, nav) y UI compartida
├── utils/
│   ├── supabase/         # clientes de Supabase y tipos generados
│   ├── auth/             # helpers de autorización (requireAdmin, etc.)
│   ├── dates/
│   └── hooks/
└── proxy.ts              # protección de rutas por sesión y rol
supabase/
├── config.toml
└── migrations/           # esquema, políticas RLS y RPCs
```

## Autenticación y roles

- **Registro por invitación**: un admin crea una invitación (email + rol) y obtiene un link `/invite/<token>` que vence a los 7 días. El trigger `handle_new_user_invitation` rechaza cualquier registro sin una invitación válida para ese email y guarda el rol en `app_metadata.role`.
- **Rol en el JWT**: el rol vive en `app_metadata`, que el usuario no puede modificar. Las políticas RLS lo leen con `is_admin()` / `is_driver()`.
- **Proxy** (`src/proxy.ts`): redirige a `/login` si no hay sesión, y a cada rol a su home (`/admin/routes` o `/driver`) si intenta entrar a las rutas del otro.
- **RLS**: el admin puede leer y escribir todo; el chofer solo ve sus rutas, paradas, pedidos y clientes asociados, y solo puede actualizar el estado de sus paradas y rutas.

## Base de datos

Tablas principales: `clients`, `products`, `orders`, `order_details`, `routes`, `stops`, `vehicles`, `profiles`, `invitations` y `notifications`.

Para hacer un cambio en el esquema:

```bash
npx supabase migration new <descripcion_corta>
# editá el archivo generado en supabase/migrations/
npx supabase db push
```

Las migraciones siguen el formato `YYYYMMDDHHMMSS_descripcion.sql`. Después de cambiar el esquema, regenerá los tipos:

```bash
npx supabase gen types typescript --linked > src/utils/supabase/database.types.ts
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |

## Convenciones

- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), con scope cuando aplica: `feat:`, `fix(driver):`, `refactor(routes):`.
- Cada dominio vive en `src/modules/<dominio>` y separa Server Actions (`.actions.ts`) del acceso a datos (`.dal.ts`).
- Estilos con CSS Modules, un archivo por componente o módulo.
