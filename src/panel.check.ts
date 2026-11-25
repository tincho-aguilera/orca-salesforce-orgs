import { defineCheck } from 'orca/testing'

const sampleState = {
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
      kind: 'sandbox',
      connectedStatus: 'Connected',
      isDefaultUsername: false,
      isCurrent: true,
      expirationDate: null
    },
    {
      username: 'servicevoice@puzzles.solutions',
      alias: 'SEK_Prod',
      orgId: '00D0Y000002ITQ6UAO',
      name: 'INSTITUCIÓN EDUCATIVA SEK S.L.',
      instanceUrl: 'https://sek.my.salesforce.com',
      kind: 'production',
      connectedStatus: 'Connected',
      isDefaultUsername: false,
      isCurrent: false,
      expirationDate: null
    }
  ],
  error: null,
  updatedAt: 1700000000000
}

export default defineCheck({
  fresh: {},
  loaded: {
    storage: {
      orgsState: sampleState
    }
  }
})
