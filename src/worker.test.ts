import { assert, mockHost, mountWorker, test } from 'orca/testing'
import { createWorker, normalizeOrgs } from './worker'

test('normalizes and sorts current org first', () => {
  const orgs = normalizeOrgs(
    {
      other: [
        {
          username: 'user@prod.com',
          alias: 'Prod',
          orgId: '00D1',
          instanceUrl: 'https://prod.my.salesforce.com',
          isSandbox: false,
          isScratch: false,
          connectedStatus: 'Connected'
        }
      ],
      sandboxes: [
        {
          username: 'user@dev.com',
          alias: 'Dev',
          orgId: '00D2',
          instanceUrl: 'https://dev.sandbox.my.salesforce.com',
          isSandbox: true,
          isScratch: false,
          connectedStatus: 'Connected'
        }
      ]
    },
    'Dev'
  )

  assert.equal(orgs.length, 2)
  assert.equal(orgs[0].alias, 'Dev')
  assert.equal(orgs[0].isCurrent, true)
  assert.equal(orgs[1].alias, 'Prod')
  assert.equal(orgs[1].isCurrent, false)
})

test('worker lists orgs, updates status bar and opens an org', async () => {
  const calls: string[][] = []
  const fakeRunner = {
    async exec(args: string[]) {
      calls.push(args)
      if (args[0] === 'config' && args[1] === 'get') {
        return JSON.stringify({
          result: [{ name: 'target-org', value: 'ACHS_dev', location: 'Local' }]
        })
      }
      if (args[0] === 'config' && args[1] === 'set') {
        return JSON.stringify({ status: 0, result: [{ name: 'target-org', value: args[3] }] })
      }
      if (args[0] === 'org' && args[1] === 'list') {
        return JSON.stringify({
          result: {
            sandboxes: [
              {
                username: 'maguilerade@achs.cl.maguilera',
                alias: 'ACHS_dev',
                orgId: '00DO8',
                instanceUrl: 'https://achs--maguilera.sandbox.my.salesforce.com',
                isSandbox: true,
                isScratch: false,
                connectedStatus: 'Connected'
              }
            ]
          }
        })
      }
      if (args[0] === 'org' && args[1] === 'open') {
        return JSON.stringify({ status: 0, result: { url: 'https://achs--maguilera.sandbox.my.salesforce.com' } })
      }
      return '{}'
    }
  }

  const host = mockHost({
    results: {
      'workspace.readContext': { workspaceId: 'ws1', branch: 'main', displayName: 'achs', terminals: [] },
      'workspace.list': {
        workspaces: [{ id: 'ws1', kind: 'folder', name: 'achs', path: '/tmp/achs', branch: 'main', hostId: null }],
        truncated: false
      },
      'statusBar.update': { ok: true }
    }
  })

  const worker = await mountWorker({ default: createWorker(fakeRunner) }, { host })
  const state = await worker.request('orgs.refresh')
  assert.equal(state.currentOrg, 'ACHS_dev')
  assert.equal(state.orgs.length, 1)
  assert.equal(state.orgs[0].isCurrent, true)

  const openRes = await worker.request('orgs.open', { target: 'ACHS_dev' })
  assert.deepEqual(openRes, { ok: true, target: 'ACHS_dev' })
  assert.ok(calls.some((c) => c[0] === 'org' && c[1] === 'open' && c[3] === 'ACHS_dev'))

  const selectRes = await worker.request('orgs.select', { target: 'ACHS_dev', open: true })
  assert.equal(selectRes.ok, true)
  assert.ok(calls.some((c) => c[0] === 'config' && c[1] === 'set' && c[2] === 'target-org' && c[3] === 'ACHS_dev'))
  assert.deepEqual(worker.refusals, [])
  await worker.deactivate()
})
