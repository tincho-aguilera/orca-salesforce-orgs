export interface SalesforceOrg {
  username: string
  alias: string | null
  orgId: string
  name: string | null
  instanceUrl: string
  kind: 'production' | 'sandbox' | 'scratch' | 'devhub' | 'other'
  connectedStatus: string | null
  isDefaultUsername: boolean
  isCurrent: boolean
  expirationDate: string | null
}

export interface OrgsState {
  currentOrg: string | null
  currentOrgLocation: string | null
  workspaceName: string | null
  orgs: SalesforceOrg[]
  error: string | null
  updatedAt: number
}

declare module 'orca' {
  interface PluginRequests {
    /** Devuelve el estado actual (usa caché si existe o consulta sf CLI). */
    'orgs.list': { output: OrgsState }
    /** Fuerza una recarga desde `sf org list --json` y `sf config get target-org --json`. */
    'orgs.refresh': { output: OrgsState }
    /** Abre la org indicada en el navegador mediante `sf org open`. */
    'orgs.open': { input: { target: string }; output: { ok: boolean; target: string; error?: string } }
    /** Cambia el `target-org` al indicado (y opcionalmente lo abre en el navegador). */
    'orgs.select': {
      input: { target: string; open?: boolean }
      output: { ok: boolean; target: string; state?: OrgsState; error?: string }
    }
  }
  interface PluginPanelEvents {
    /** Se emite a los paneles abiertos cuando cambia la lista o la org actual. */
    'orgs.changed': OrgsState
  }
}
