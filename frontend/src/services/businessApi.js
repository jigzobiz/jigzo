import axios from 'axios';

const client = axios.create({ baseURL: '/api/business', timeout: 15000, withCredentials: true });
const stagingTestClient = axios.create({ baseURL: '/api/test', timeout: 45000, withCredentials: true });
let csrfToken = '';
export const businessApi = {
  requestMagicLink: async (email) => (await client.post('/auth/request-link', { email })).data,
  verifyMagicLink: async (token) => { const { data } = await client.post('/auth/verify', { token }); csrfToken = data.csrfToken; return data; },
  establishSession: async () => { const { data } = await client.get('/auth/session'); csrfToken = data.csrfToken; return data; },
  listCampaigns: async () => (await client.get('/campaigns')).data.campaigns,
  createCampaign: async ({ revision, ...draft }) => (await client.post('/campaigns', draft, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign,
  getCampaign: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}`)).data.campaign,
  patchCampaign: async (campaignId, patch) => (await client.patch(`/campaigns/${encodeURIComponent(campaignId)}`, patch, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign
  ,deleteCampaign: async (campaignId) => client.delete(`/campaigns/${encodeURIComponent(campaignId)}`, { headers: { 'X-JIGZO-CSRF': csrfToken } })
  ,listRecipients: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients`)).data.recipients
  ,getRecipient: async (campaignId, recipientId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`)).data.recipient
  ,createRecipient: async (campaignId, value) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/recipients`, value, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.recipient
  ,updateRecipient: async (campaignId, recipientId, value) => (await client.patch(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`, value, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.recipient
  ,deleteRecipient: async (campaignId, recipientId) => client.delete(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`, { headers: { 'X-JIGZO-CSRF': csrfToken } })
  ,downloadRecipientTemplate: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients/template`, { responseType: 'blob' })).data
  ,validateRecipientImport: async (campaignId, file) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/imports`, await file.text(), { headers: { 'X-JIGZO-CSRF': csrfToken, 'Content-Type': 'text/csv', 'X-JIGZO-Filename': file.name } })).data
  ,commitRecipientImport: async (campaignId, importId) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/imports/${encodeURIComponent(importId)}/commit`, {}, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.import
  ,persistPuzzle: async (campaignId, image) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/puzzle`, image, { headers: { 'X-JIGZO-CSRF': csrfToken, 'Content-Type': image.type } })).data.puzzle
  ,issueRecipientLink: async (campaignId, recipientId) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}/access-link`, {}, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data
  ,getResults: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/results`)).data
  ,getDeliveryValidation: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/delivery-validation`)).data
  ,getDeliveryProgress: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/delivery-progress`)).data
  ,sendDeliveryTest: async (campaignId, value, idempotencyKey) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/test-send`, value, { headers: { 'X-JIGZO-CSRF': csrfToken, 'Idempotency-Key': idempotencyKey } })).data
  ,launchCampaign: async (campaignId) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/launch`, {}, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data
  ,scheduleCampaign: async (campaignId, scheduledSendAt) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/schedule`, { scheduledSendAt }, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data
  ,createConsumerTestPuzzle: async (value) => (await stagingTestClient.post('/reveals', value, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data
};
