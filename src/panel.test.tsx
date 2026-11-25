import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'

const mockState = {
  currentOrg: 'ACHS_dev',
  currentOrgLocation: 'Local',
  workspaceName: 'achs',
  orgs: [
    {
      username: 'maguilerade@achs.cl.maguilera',
      alias: 'ACHS_dev',
      orgId: '00DO800000ZrTfgMAF',
      name: 'ACHS',
      instanceUrl: 'https://achs--maguilera.sandbox.my.salesforce.com',
      kind: 'sandbox' as const,
      connectedStatus: 'Connected',
      isDefaultUsername: false,
      isCurrent: true,
      expirationDate: null
    },
    {
      username: 'servicevoice@puzzles.solutions',
      alias: 'SEK_Prod',
      orgId: '00D0Y000002ITQ6UAO',
      name: 'SEK',
      instanceUrl: 'https://sek.my.salesforce.com',
      kind: 'production' as const,
      connectedStatus: 'Connected',
      isDefaultUsername: false,
      isCurrent: false,
      expirationDate: null
    }
  ],
  error: null,
  updatedAt: 1700000000000
}

test('renders orgs list and opens selected org', async () => {
  const selected: string[] = []
  const host = mockHost({
    requests: {
      'orgs.list': () => mockState,
      'orgs.refresh': () => mockState,
      'orgs.open': ({ target }: { target: string }) => ({ ok: true, target }),
      'orgs.select': ({ target }: { target: string }) => {
        selected.push(target)
        return { ok: true, target, state: { ...mockState, currentOrg: target } }
      }
    }
  })

  const view = await mount(panel, { host })
  const items = view.findAll({ type: 'ListItem' })
  assert.equal(items.length, 2)

  await view.press({ text: /SEK_Prod/ })
  assert.deepEqual(selected, ['SEK_Prod'])

  await view.type({ type: 'Input' }, 'SEK')
  assert.equal(view.findAll({ type: 'ListItem' }).length, 1)

  assert.deepEqual(view.errors, [])
  assert.deepEqual(view.refusals, [])
  await view.unmount()
})
