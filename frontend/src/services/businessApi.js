import axios from 'axios';

const client = axios.create({ baseURL: '/api/business', timeout: 15000, withCredentials: true });
let csrfToken = '';
export const businessApi = {
  verifyMagicLink: async (token) => { const { data } = await client.post('/auth/verify', { token }); csrfToken = data.csrfToken; return data; },
  establishSession: async () => { const { data } = await client.get('/auth/session'); csrfToken = data.csrfToken; return data; },
  createCampaign: async ({ revision, ...draft }) => (await client.post('/campaigns', draft, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign,
  getCampaign: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}`)).data.campaign,
  patchCampaign: async (campaignId, patch) => (await client.patch(`/campaigns/${encodeURIComponent(campaignId)}`, patch, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign
  ,listRecipients: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients`)).data.recipients
  ,getRecipient: async (campaignId, recipientId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`)).data.recipient
  ,createRecipient: async (campaignId, value) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/recipients`, value, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.recipient
  ,updateRecipient: async (campaignId, recipientId, value) => (await client.patch(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`, value, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.recipient
  ,deleteRecipient: async (campaignId, recipientId) => client.delete(`/campaigns/${encodeURIComponent(campaignId)}/recipients/${encodeURIComponent(recipientId)}`, { headers: { 'X-JIGZO-CSRF': csrfToken } })
  ,downloadRecipientTemplate: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}/recipients/template`, { responseType: 'blob' })).data
  ,validateRecipientImport: async (campaignId, file) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/imports`, await file.text(), { headers: { 'X-JIGZO-CSRF': csrfToken, 'Content-Type': 'text/csv', 'X-JIGZO-Filename': file.name } })).data.import
  ,commitRecipientImport: async (campaignId, importId) => (await client.post(`/campaigns/${encodeURIComponent(campaignId)}/imports/${encodeURIComponent(importId)}/commit`, {}, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.import
};
