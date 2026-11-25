# Orca Salesforce Orgs

Plugin para [Orca](https://www.onorca.dev/) que lista tus orgs autenticadas de Salesforce usando Salesforce CLI (`sf`), muestra la org activa en la barra de estado y permite cambiar de `target-org` y abrir cualquier org en el navegador con un clic.

## Funcionalidades

- **Panel lateral (`Salesforce Orgs`)**:
  - Lista todas las orgs devueltas por `sf org list --json` (Production, Sandbox, Scratch, DevHub) indicando alias, usuario, tipo y estado de conexión.
  - Destaca la org configurada actualmente (`target-org`) en el workspace activo.
  - Filtro rápido por alias, username, nombre o Org ID.
  - Clic sobre cualquier org para configurarla como `target-org` (`sf config set target-org`) y abrirla en el navegador (`sf org open`).
- **Barra de estado**: Muestra `SF: <org>` (o `SF: sin org` / `SF: error`). Al hacer clic abre la org actual en el navegador.
- **Comandos de paleta**:
  - `Salesforce: Abrir org actual`
  - `Salesforce: Refrescar orgs`
- **Sincronización automática**: Se actualiza al cambiar de workspace en Orca (`workspace.changed`).

## Requisitos

- [Orca](https://www.onorca.dev/) `>= 1.4.248`
- [Salesforce CLI (`sf`)](https://developer.salesforce.com/tools/salesforcecli) instalado y disponible en `/usr/local/bin/sf`, `/opt/homebrew/bin/sf` o en el `PATH`, con al menos una org autenticada (`sf org login web`).

## Instalación

### Desde Orca CLI

```sh
orca plugin install tincho-aguilera/orca-salesforce-orgs
```

### Desde la UI de Orca

1. Abrí **Settings → Plugins**.
2. Agregá el marketplace comunitario (`https://github.com/stablyai/orca-community-plugins.git`, rama `main`) o instalá directamente desde la URL del repositorio.
3. Aprobá los permisos solicitados (el plugin usa `trusted-worker` para ejecutar `sf` localmente, leer el workspace activo, guardar caché en `orca.storage` y mostrar notificaciones).

## Permisos (`capabilities`)

- `workspace:read`: Lee el workspace activo para ejecutar `sf` en su directorio y detectar el `target-org` local o global.
- `storage:own`: Guarda en caché la última lista de orgs consultada.
- `notifications:show`: Muestra notificaciones de escritorio al abrir orgs o ante errores.
- `trusted-worker`: Ejecuta los subprocesos de `sf` (`org list`, `config get/set target-org`, `org open`).

## Desarrollo local

```sh
# Validar el manifest y los permisos
orca plugin validate .

# Ejecutar tests y verificación de render del panel
orca plugin test .
orca plugin check .

# Cargar en modo desarrollo con recarga automática y logs
orca plugin dev watch .
```
