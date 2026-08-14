import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { businessApi } from '../../services/businessApi';

const initialState = {
  identity: { campaignId: null, organizationId: null, revision: null, status: 'local-draft' },
  studio: { activeArea: 0, visitedAreas: [0], selectedRecipientId: null, saveState: 'loading', saveError: '' },
  campaign: { name: 'The Atelier Opening', experienceType: 'invitation' },
  puzzle: { imagePreviewUrl: null, difficultyId: 'classic', mysteryMode: false },
  experience: { eventTitle: 'An evening at The Atelier', dateTime: '2026-10-24T19:30', timezone: 'Asia/Bahrain', location: 'The Atelier, Manama', rsvpDeadline: '2026-10-18', message: 'Sara, we would love you to join us for an intimate evening of art, conversation and a little surprise.', rsvpEnabled: true, allowPlusOneDefault: false },
  recipients: { entitiesById: {}, orderedIds: [], loading: true },
  delivery: { channel: 'whatsapp' },
  sync: { hydrated: false, dirty: false, changeSequence: 0 }
};

function fromServer(state, campaign) {
  return { ...state,
    identity: { campaignId: campaign.campaignId, organizationId: null, revision: campaign.revision, status: campaign.status },
    studio: { ...state.studio, saveState: 'saved', saveError: '' },
    campaign: { name: campaign.name, experienceType: campaign.experienceType },
    puzzle: { ...state.puzzle, difficultyId: campaign.puzzle?.difficultyId || 'classic', mysteryMode: Boolean(campaign.puzzle?.mysteryMode) },
    experience: { eventTitle: campaign.invitation?.eventTitle || '', dateTime: campaign.invitation?.eventDateTime ? String(campaign.invitation.eventDateTime).slice(0, 16) : '', timezone: campaign.invitation?.timezone || 'Asia/Bahrain', location: campaign.invitation?.location || '', rsvpDeadline: campaign.invitation?.rsvpDeadline ? String(campaign.invitation.rsvpDeadline).slice(0, 10) : '', message: campaign.invitation?.message || '', rsvpEnabled: campaign.invitation?.rsvpEnabled !== false, allowPlusOneDefault: Boolean(campaign.invitation?.allowPlusOneDefault) },
    delivery: { channel: campaign.deliveryDefault || 'whatsapp' }, sync: { hydrated: true, dirty: false, changeSequence: state.sync.changeSequence }
  };
}
function toServer(state) { return { revision: state.identity.revision, name: state.campaign.name, puzzle: { difficultyId: state.puzzle.difficultyId, mysteryMode: state.puzzle.mysteryMode }, invitation: { eventTitle: state.experience.eventTitle, eventDateTime: state.experience.dateTime || null, timezone: state.experience.timezone, location: state.experience.location, rsvpDeadline: state.experience.rsvpDeadline || null, message: state.experience.message, rsvpEnabled: state.experience.rsvpEnabled, allowPlusOneDefault: state.experience.allowPlusOneDefault }, deliveryDefault: state.delivery.channel } }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AREA': return { ...state, studio: { ...state.studio, activeArea: action.area, visitedAreas: [...new Set([...state.studio.visitedAreas, action.area])] } };
    case 'SET_FIELD': { const persisted = ['campaign', 'puzzle', 'experience', 'delivery'].includes(action.section); return { ...state, [action.section]: { ...state[action.section], [action.field]: action.value }, studio: persisted ? { ...state.studio, saveState: 'saving', saveError: '' } : state.studio, sync: persisted ? { ...state.sync, dirty: true, changeSequence: state.sync.changeSequence + 1 } : state.sync }; }
    case 'HYDRATE': return fromServer(state, action.campaign);
    case 'SAVE_SUCCESS': return { ...state, identity: { ...state.identity, revision: action.campaign.revision, status: action.campaign.status }, studio: { ...state.studio, saveState: state.sync.changeSequence === action.sequence ? 'saved' : 'saving', saveError: '' }, sync: { ...state.sync, dirty: state.sync.changeSequence !== action.sequence } };
    case 'SAVE_ERROR': return { ...state, studio: { ...state.studio, saveState: 'error', saveError: action.message } };
    case 'SELECT_RECIPIENT': return { ...state, studio: { ...state.studio, selectedRecipientId: action.id } };
    case 'LOAD_RECIPIENTS': { const entitiesById = Object.fromEntries(action.recipients.map(item => [item.recipientId, item])); const orderedIds = action.recipients.map(item => item.recipientId); return { ...state, recipients: { entitiesById, orderedIds, loading: false }, studio: { ...state.studio, selectedRecipientId: orderedIds.includes(state.studio.selectedRecipientId) ? state.studio.selectedRecipientId : orderedIds[0] || null } }; }
    case 'SET_RECIPIENT_OVERRIDE': return { ...state, recipients: { ...state.recipients, entitiesById: { ...state.recipients.entitiesById, [action.id]: { ...state.recipients.entitiesById[action.id], plusOne: action.value } } } };
    case 'REMOVE_RECIPIENT': {
      const entitiesById = { ...state.recipients.entitiesById }; delete entitiesById[action.id];
      const orderedIds = state.recipients.orderedIds.filter((id) => id !== action.id);
      const selectedRecipientId = action.id === state.studio.selectedRecipientId ? orderedIds.find((id) => entitiesById[id]?.status === 'valid') || null : state.studio.selectedRecipientId;
      return { ...state, studio: { ...state.studio, selectedRecipientId }, recipients: { entitiesById, orderedIds } };
    }
    default: return state;
  }
}

const StudioContext = createContext(null);
export function CampaignStudioProvider({ campaignId, onCreated, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const latest = useRef(state); latest.current = state;
  useEffect(() => { let cancelled = false; (async () => { try { await businessApi.establishSession(); const campaign = campaignId ? await businessApi.getCampaign(campaignId) : await businessApi.createCampaign(toServer(initialState)); const recipientRows = await businessApi.listRecipients(campaign.campaignId); if (!cancelled) { dispatch({ type: 'HYDRATE', campaign }); dispatch({ type: 'LOAD_RECIPIENTS', recipients: recipientRows }); if (!campaignId) onCreated(campaign.campaignId); } } catch (error) { if (!cancelled) dispatch({ type: 'SAVE_ERROR', message: error.response?.status === 401 ? 'Sign in is required to save this draft.' : 'Draft could not be loaded.' }); } })(); return () => { cancelled = true; }; }, [campaignId, onCreated]);
  useEffect(() => { if (!state.sync.hydrated || !state.sync.dirty || !state.identity.campaignId) return undefined; const sequence = state.sync.changeSequence; const timer = window.setTimeout(async () => { try { const campaign = await businessApi.patchCampaign(state.identity.campaignId, toServer(latest.current)); dispatch({ type: 'SAVE_SUCCESS', campaign, sequence }); } catch (error) { dispatch({ type: 'SAVE_ERROR', message: error.response?.status === 409 ? 'A newer version exists. Refresh before continuing.' : 'Changes are not saved yet.' }); } }, 800); return () => window.clearTimeout(timer); }, [state.sync.hydrated, state.sync.dirty, state.sync.changeSequence, state.identity.campaignId, state.identity.revision]);
  const recipientActions = useMemo(() => ({ reload: async () => dispatch({ type: 'LOAD_RECIPIENTS', recipients: await businessApi.listRecipients(state.identity.campaignId) }), create: async value => { await businessApi.createRecipient(state.identity.campaignId, value); dispatch({ type: 'LOAD_RECIPIENTS', recipients: await businessApi.listRecipients(state.identity.campaignId) }); }, update: async (id, value) => { await businessApi.updateRecipient(state.identity.campaignId, id, value); dispatch({ type: 'LOAD_RECIPIENTS', recipients: await businessApi.listRecipients(state.identity.campaignId) }); dispatch({ type: 'SELECT_RECIPIENT', id }); }, remove: async id => { await businessApi.deleteRecipient(state.identity.campaignId, id); dispatch({ type: 'LOAD_RECIPIENTS', recipients: await businessApi.listRecipients(state.identity.campaignId) }); } }), [state.identity.campaignId]);
  const value = useMemo(() => ({ state, dispatch, recipientActions }), [state, recipientActions]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
export function useCampaignStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useCampaignStudio must be used within CampaignStudioProvider');
  return value;
}
