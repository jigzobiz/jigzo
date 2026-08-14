import axios from 'axios';

const client = axios.create({ baseURL: '/api/business', timeout: 15000, withCredentials: true });
let csrfToken = '';
export const businessApi = {
  verifyMagicLink: async (token) => { const { data } = await client.post('/auth/verify', { token }); csrfToken = data.csrfToken; return data; },
  establishSession: async () => { const { data } = await client.get('/auth/session'); csrfToken = data.csrfToken; return data; },
  createCampaign: async ({ revision, ...draft }) => (await client.post('/campaigns', draft, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign,
  getCampaign: async (campaignId) => (await client.get(`/campaigns/${encodeURIComponent(campaignId)}`)).data.campaign,
  patchCampaign: async (campaignId, patch) => (await client.patch(`/campaigns/${encodeURIComponent(campaignId)}`, patch, { headers: { 'X-JIGZO-CSRF': csrfToken } })).data.campaign
};
