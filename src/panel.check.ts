import { defineCheck } from 'orca/testing'

const sampleState = {
  currentOrg: 'dev-sandbox',
  currentOrgLocation: 'Local',
  workspaceName: 'salesforce-app',
  orgs: [
    {
      username: 'dev@example.com.sandbox',
      alias: 'dev-sandbox',
      orgId: '00D000000000001AAA',
      name: 'Acme Sandbox',
      instanceUrl: 'https://acme--dev.sandbox.my.salesforce.com',
      kind: 'sandbox',
      connectedStatus: 'Connected',
      isDefaultUsername: false,
      isCurrent: true,
      expirationDate: null
    },
    {
      username: 'admin@example.com',
      alias: 'acme-prod',
      orgId: '00D000000000002AAA',
      name: 'Acme Production',
      instanceUrl: 'https://acme.my.salesforce.com',
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
