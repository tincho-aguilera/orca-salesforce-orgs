import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { promisify } from 'node:util'
import type { OrcaWorkerApi } from 'orca/worker'
import type { OrgsState, SalesforceOrg } from './protocol'

const execFileAsync = promisify(execFile)
const STATE_KEY = 'orgsState'

interface RawSfOrg {
  username?: string
  alias?: string | null
  orgId?: string
  name?: string | null
  instanceUrl?: string
  isSandbox?: boolean
  isScratch?: boolean
  isDevHub?: boolean
  isDefaultUsername?: boolean
  connectedStatus?: string | null
  expirationDate?: string | null
}

export interface SfRunner {
  exec(args: string[], cwd: string, signal?: AbortSignal): Promise<string>
}

function resolveSfBinary(): string {
  const candidates = ['/usr/local/bin/sf', '/opt/homebrew/bin/sf', 'sf']
  for (const bin of candidates) {
    if (bin === 'sf') return bin
    try {
      accessSync(bin, constants.X_OK)
      return bin
    } catch {
      // try next
    }
  }
  return 'sf'
}

const defaultRunner: SfRunner = {
  async exec(args, cwd, signal) {
    const bin = resolveSfBinary()
    const env = {
      ...process.env,
      PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}`,
      SF_NO_COLOR: 'true',
      FORCE_COLOR: '0'
    }
    const { stdout } = await execFileAsync(bin, args, {
      cwd,
      env,
      timeout: 25000,
      maxBuffer: 4 * 1024 * 1024,
      signal
    })
    return stdout
  }
}

async function getActiveWorkspace(orca: OrcaWorkerApi): Promise<{ cwd: string; name: string | null }> {
  const fallbackCwd = process.env.HOME ?? process.cwd()
  try {
    const ctx = await orca.host.call('workspace.readContext')
    if (!ctx?.workspaceId) {
      return { cwd: fallbackCwd, name: ctx?.displayName ?? null }
    }
    const list = await orca.host.call('workspace.list')
    const match = list.workspaces.find((w) => w.id === ctx.workspaceId)
    return {
      cwd: match?.path ?? fallbackCwd,
      name: ctx.displayName || match?.name || null
    }
  } catch {
    return { cwd: fallbackCwd, name: null }
  }
}

function classifyOrg(raw: RawSfOrg): SalesforceOrg['kind'] {
  if (raw.isScratch) return 'scratch'
  if (raw.isSandbox) return 'sandbox'
  if (raw.isDevHub) return 'devhub'
  if (raw.isSandbox === false && raw.isScratch === false) return 'production'
  return 'other'
}

export function normalizeOrgs(rawResult: Record<string, unknown>, currentOrg: string | null): SalesforceOrg[] {
  const buckets = ['devHubs', 'nonScratchOrgs', 'sandboxes', 'scratchOrgs', 'other']
  const byUsername = new Map<string, SalesforceOrg>()

  for (const bucket of buckets) {
    const list = rawResult[bucket]
    if (!Array.isArray(list)) continue
    for (const item of list as RawSfOrg[]) {
      if (!item?.username) continue
      const alias = item.alias ?? null
      const isCurrent =
        currentOrg !== null && (alias === currentOrg || item.username === currentOrg)
      const existing = byUsername.get(item.username)
      const normalized: SalesforceOrg = {
        username: item.username,
        alias: alias ?? existing?.alias ?? null,
        orgId: item.orgId ?? existing?.orgId ?? '',
        name: item.name ?? existing?.name ?? null,
        instanceUrl: item.instanceUrl ?? existing?.instanceUrl ?? '',
        kind: classifyOrg(item),
        connectedStatus: item.connectedStatus ?? existing?.connectedStatus ?? null,
        isDefaultUsername: Boolean(item.isDefaultUsername || existing?.isDefaultUsername),
        isCurrent: Boolean(isCurrent || existing?.isCurrent),
        expirationDate: item.expirationDate ?? existing?.expirationDate ?? null
      }
      byUsername.set(item.username, normalized)
    }
  }

  return Array.from(byUsername.values()).sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    if (a.isDefaultUsername !== b.isDefaultUsername) return a.isDefaultUsername ? -1 : 1
    return (a.alias ?? a.username).localeCompare(b.alias ?? b.username)
  })
}

async function fetchCurrentOrg(
  runner: SfRunner,
  cwd: string,
  signal?: AbortSignal
): Promise<{ value: string | null; location: string | null }> {
  try {
    const out = await runner.exec(['config', 'get', 'target-org', '--json'], cwd, signal)
    const parsed = JSON.parse(out) as {
      result?: Array<{ name?: string; value?: string; location?: string }>
    }
    const entry = parsed.result?.find((r) => r.name === 'target-org' && r.value)
    return {
      value: entry?.value ?? null,
      location: entry?.location ?? null
    }
  } catch {
    return { value: null, location: null }
  }
}

async function updateStatusBar(orca: OrcaWorkerApi, state: OrgsState): Promise<void> {
  if (state.error) {
    await orca.host
      .call('statusBar.update', {
        id: 'current-org',
        text: 'SF: error',
        tone: 'warning',
        tooltip: state.error
      })
      .catch(() => {})
    return
  }

  if (state.currentOrg) {
    const loc = state.currentOrgLocation ? ` (${state.currentOrgLocation})` : ''
    await orca.host
      .call('statusBar.update', {
        id: 'current-org',
        text: `SF: ${state.currentOrg}`,
        tone: 'accent',
        tooltip: `Org actual: ${state.currentOrg}${loc} — Clic para abrir`
      })
      .catch(() => {})
    return
  }

  await orca.host
    .call('statusBar.update', {
      id: 'current-org',
      text: 'SF: sin org',
      tone: 'neutral',
      tooltip: `${state.orgs.length} org(s) disponibles. Configurá target-org o abrí el panel lateral.`
    })
    .catch(() => {})
}

export function assertValidTarget(target: unknown): string {
  if (typeof target !== 'string') {
    throw new Error('El identificador de la org es inválido.')
  }
  const trimmed = target.trim()
  if (!trimmed || trimmed.length > 256) {
    throw new Error('El identificador de la org es inválido.')
  }
  if (trimmed.startsWith('-')) {
    throw new Error('El identificador de la org no puede comenzar con "-".')
  }
  if (!/^[A-Za-z0-9_@.+:-]+$/.test(trimmed)) {
    throw new Error('El identificador de la org contiene caracteres no permitidos.')
  }
  return trimmed
}

export function createWorker(runner: SfRunner = defaultRunner) {
  return function activate(orca: OrcaWorkerApi): void {
    let inflight: Promise<OrgsState> | null = null

    async function refreshState(signal?: AbortSignal): Promise<OrgsState> {
      if (inflight) return inflight
      inflight = (async () => {
        const { cwd, name: workspaceName } = await getActiveWorkspace(orca)
        const current = await fetchCurrentOrg(runner, cwd, signal)

        try {
          const out = await runner.exec(['org', 'list', '--json'], cwd, signal)
          const parsed = JSON.parse(out) as { result?: Record<string, unknown> }
          const orgs = normalizeOrgs(parsed.result ?? {}, current.value)
          const state: OrgsState = {
            currentOrg: current.value,
            currentOrgLocation: current.location,
            workspaceName,
            orgs,
            error: null,
            updatedAt: Date.now()
          }
          await orca.storage.set(STATE_KEY, state as unknown as Record<string, never>).catch(() => {})
          await updateStatusBar(orca, state)
          orca.panels.post('orgs.changed', state)
          return state
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const state: OrgsState = {
            currentOrg: current.value,
            currentOrgLocation: current.location,
            workspaceName,
            orgs: [],
            error: `No se pudo ejecutar sf org list: ${message}`,
            updatedAt: Date.now()
          }
          await updateStatusBar(orca, state)
          orca.panels.post('orgs.changed', state)
          return state
        }
      })().finally(() => {
        inflight = null
      })

      return inflight
    }

    async function setCurrentOrg(target: string, cwd: string, signal?: AbortSignal): Promise<void> {
      const safeTarget = assertValidTarget(target)
      try {
        await runner.exec(['config', 'set', 'target-org', safeTarget, '--json'], cwd, signal)
      } catch {
        await runner.exec(['config', 'set', 'target-org', safeTarget, '--global', '--json'], cwd, signal)
      }
    }

    async function openOrg(target: string, signal?: AbortSignal): Promise<{ ok: boolean; target: string; error?: string }> {
      let safeTarget: string
      try {
        safeTarget = assertValidTarget(target)
      } catch (err) {
        return { ok: false, target: String(target ?? ''), error: err instanceof Error ? err.message : String(err) }
      }
      const { cwd } = await getActiveWorkspace(orca)
      try {
        await runner.exec(['org', 'open', '-o', safeTarget, '--json'], cwd, signal)
        return { ok: true, target: safeTarget }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        orca.log(`Error abriendo org ${safeTarget}: ${message}`)
        return { ok: false, target: safeTarget, error: message }
      }
    }

    orca.panels.handle('orgs.list', async (_input, { signal }) => {
      const cached = (await orca.storage.get(STATE_KEY)) as OrgsState | null
      if (cached && Array.isArray(cached.orgs) && cached.orgs.length > 0) {
        void refreshState()
        return cached
      }
      return refreshState(signal)
    })

    orca.panels.handle('orgs.refresh', async (_input, { signal }) => refreshState(signal))

    orca.panels.handle('orgs.open', async ({ target }, { signal }) => openOrg(target, signal))

    orca.panels.handle('orgs.select', async ({ target, open = true }, { signal }) => {
      const { cwd } = await getActiveWorkspace(orca)
      try {
        await setCurrentOrg(target, cwd, signal)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        orca.log(`Error cambiando target-org a ${target}: ${message}`)
        return { ok: false, target, error: message }
      }

      const state = await refreshState(signal)
      if (!open) {
        return { ok: true, target, state }
      }

      const openRes = await openOrg(target, signal)
      return { ok: openRes.ok, target, state, error: openRes.error }
    })

    orca.commands.register('salesforce-orgs.openCurrent', async () => {
      const state = await refreshState()
      if (!state.currentOrg) {
        await orca.host
          .call('notifications.show', {
            title: 'Salesforce Orgs',
            body: 'No hay una org actual (target-org) configurada en este workspace.'
          })
          .catch(() => {})
        return 'Sin org actual configurada'
      }
      const res = await openOrg(state.currentOrg)
      if (!res.ok) {
        await orca.host
          .call('notifications.show', {
            title: 'Error al abrir org',
            body: res.error ?? state.currentOrg
          })
          .catch(() => {})
        return `Error abriendo ${state.currentOrg}: ${res.error}`
      }
      return `Abriendo ${state.currentOrg}`
    })

    orca.commands.register('salesforce-orgs.refresh', async () => {
      const state = await refreshState()
      return `${state.orgs.length} org(s) cargadas`
    })

    orca.events.on('workspace.changed', async () => {
      await refreshState()
    })

    void refreshState()
  }
}

export default createWorker(defaultRunner)
