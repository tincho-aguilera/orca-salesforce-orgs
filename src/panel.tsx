import {
  atom,
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  plugin,
  read,
  Row,
  set,
  Spinner,
  Stack,
  Text,
  type PanelContext
} from 'orca'
import type { OrgsState, SalesforceOrg } from './protocol'

const orgsState = atom<OrgsState | null>(null)
const loading = atom<boolean>(true)
const openingTarget = atom<string | null>(null)
const query = atom('searchQuery', '', { persist: 'plugin' })
const feedback = atom<string | null>(null)

async function refresh(): Promise<void> {
  set(loading, true)
  set(feedback, null)
  try {
    const next = await plugin.request('orgs.refresh')
    set(orgsState, next)
  } catch (err) {
    set(feedback, err instanceof Error ? err.message : String(err))
  } finally {
    set(loading, false)
  }
}

async function openOrg(org: SalesforceOrg): Promise<void> {
  const target = org.alias ?? org.username
  set(openingTarget, target)
  set(feedback, null)
  try {
    const res = await plugin.request('orgs.open', { target })
    if (!res.ok) {
      set(feedback, `No se pudo abrir ${target}: ${res.error ?? 'error desconocido'}`)
    } else {
      set(feedback, `Abriendo ${target} en el navegador...`)
    }
  } catch (err) {
    set(feedback, err instanceof Error ? err.message : String(err))
  } finally {
    set(openingTarget, null)
  }
}

async function selectAndOpenOrg(org: SalesforceOrg): Promise<void> {
  const target = org.alias ?? org.username
  set(openingTarget, target)
  set(feedback, null)
  try {
    const res = await plugin.request('orgs.select', { target, open: true })
    if (res.state) {
      set(orgsState, res.state)
    }
    if (!res.ok) {
      set(feedback, `No se pudo cambiar/abrir ${target}: ${res.error ?? 'error desconocido'}`)
    } else {
      set(feedback, `Org actual cambiada a ${target} y abriendo en el navegador...`)
    }
  } catch (err) {
    set(feedback, err instanceof Error ? err.message : String(err))
  } finally {
    set(openingTarget, null)
  }
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(
    plugin.on('orgs.changed', (next) => {
      set(orgsState, next)
      set(loading, false)
    })
  )

  void plugin
    .request('orgs.list')
    .then((next) => {
      set(orgsState, next)
    })
    .catch((err) => {
      set(feedback, err instanceof Error ? err.message : String(err))
    })
    .finally(() => {
      set(loading, false)
    })
}

function matchesQuery(org: SalesforceOrg, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    (org.alias?.toLowerCase().includes(needle) ?? false) ||
    org.username.toLowerCase().includes(needle) ||
    (org.name?.toLowerCase().includes(needle) ?? false) ||
    org.orgId.toLowerCase().includes(needle)
  )
}

function kindLabel(kind: SalesforceOrg['kind']): string {
  switch (kind) {
    case 'sandbox':
      return 'Sandbox'
    case 'scratch':
      return 'Scratch'
    case 'devhub':
      return 'DevHub'
    case 'production':
      return 'Prod'
    default:
      return 'Org'
  }
}

export default function Panel() {
  const state = read(orgsState)
  const isLoading = read(loading)
  const busyTarget = read(openingTarget)
  const search = read(query)
  const message = read(feedback)

  const orgs = state?.orgs ?? []
  const filtered = orgs.filter((o) => matchesQuery(o, search.trim()))
  const currentOrgObj = orgs.find((o) => o.isCurrent) ?? null

  return (
    <Stack gap="md">
      <Row justify="between" align="center">
        <Row gap="xs" align="center">
          <Heading level={2}>Salesforce Orgs</Heading>
          {state ? <Badge tone="neutral">{orgs.length}</Badge> : null}
        </Row>
        <IconButton
          icon="refresh"
          label="Refrescar orgs"
          tooltip="Refrescar lista desde sf CLI"
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onPress={refresh}
        />
      </Row>

      {state?.currentOrg ? (
        <Card
          title={state.currentOrg}
          description={
            state.workspaceName
              ? `Org actual en ${state.workspaceName}${state.currentOrgLocation ? ` (${state.currentOrgLocation})` : ''}`
              : 'Org actual configurada'
          }
        >
          <Row justify="between" align="center" gap="sm">
            <Badge tone="accent">Actual</Badge>
            <Button
              size="sm"
              icon="open-external"
              disabled={busyTarget !== null}
              onPress={() => {
                if (currentOrgObj) {
                  void openOrg(currentOrgObj)
                } else {
                  void plugin.request('orgs.open', { target: state.currentOrg! })
                }
              }}
            >
              {busyTarget === state.currentOrg ? 'Abriendo...' : 'Abrir actual'}
            </Button>
          </Row>
        </Card>
      ) : null}

      <Input
        label="Buscar org"
        labelHidden
        type="search"
        placeholder="Filtrar por alias, usuario o nombre..."
        value={search}
        onChange={(v) => set(query, v)}
      />

      {message ? (
        <Text size="xs" tone={message.startsWith('No se pudo') ? 'danger' : 'accent'}>
          {message}
        </Text>
      ) : null}

      {state?.error ? (
        <EmptyState title="Error consultando sf CLI" description={state.error} icon="warning" />
      ) : isLoading && orgs.length === 0 ? (
        <Row gap="sm" align="center">
          <Spinner label="Cargando orgs" />
          <Text muted size="sm">
            Consultando sf org list...
          </Text>
        </Row>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description={
            orgs.length === 0
              ? 'No se encontraron orgs autenticadas en sf CLI.'
              : 'Ninguna org coincide con el filtro.'
          }
          icon="cloud"
        />
      ) : (
        <List label="Orgs de Salesforce">
          {filtered.map((org) => {
            const label = org.alias ?? org.username
            const status = org.connectedStatus ?? 'Unknown'
            const descParts = [
              org.alias ? org.username : null,
              kindLabel(org.kind),
              status,
              org.isCurrent ? 'Actual' : null
            ].filter(Boolean)
            return (
              <ListItem
                key={org.username}
                title={busyTarget === label ? `${label} (abriendo...)` : label}
                description={descParts.join(' · ')}
                icon={org.isCurrent ? 'check' : 'cloud'}
                current={org.isCurrent}
                disabled={busyTarget !== null}
                onPress={() => void selectAndOpenOrg(org)}
              />
            )
          })}
        </List>
      )}
    </Stack>
  )
}
