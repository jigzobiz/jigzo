import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { businessApi } from '../../services/businessApi';

const recipients = [
  { id: 'sara', name: 'Sara Al Khalifa', nameAr: 'سارة آل خليفة', email: 'sara@atelier.co', phone: '+973 3600 2184', status: 'valid', source: 'imported', plusOne: 'inherit' },
  { id: 'omar', name: 'Omar Rahman', nameAr: 'عمر رحمن', email: 'omar@frame.studio', phone: '+973 3981 0922', status: 'valid', source: 'manual', plusOne: 'allow', message: 'Omar, save the evening — there is a seat with your name on it.', messageAr: 'عمر، احجز هذه الأمسية — هناك مقعد يحمل اسمك.' },
  { id: 'noor', name: 'Noor Hasan', nameAr: 'نور حسن', email: 'noor@example.com', phone: '360 18', status: 'invalid', source: 'imported', plusOne: 'inherit' },
  { id: 'sara-duplicate', name: 'Sara Al Khalifa', nameAr: 'سارة آل خليفة', email: 'sara@atelier.co', phone: '+973 3600 2184', status: 'duplicate', source: 'imported', plusOne: 'inherit' }
];

const initialState = {
  identity: { campaignId: null, organizationId: null, revision: null, status: 'local-draft' },
  studio: { activeArea: 0, visitedAreas: [0], selectedRecipientId: 'sara', saveState: 'loading', saveError: '' },
  campaign: { name: 'The Atelier Opening', experienceType: 'invitation' },
  puzzle: { imagePreviewUrl: null, difficultyId: 'classic', mysteryMode: false },
  experience: { eventTitle: 'An evening at The Atelier', dateTime: '2026-10-24T19:30', timezone: 'Asia/Bahrain', location: 'The Atelier, Manama', rsvpDeadline: '2026-10-18', message: 'Sara, we would love you to join us for an intimate evening of art, conversation and a little surprise.', rsvpEnabled: true, allowPlusOneDefault: false },
  recipients: { entitiesById: Object.fromEntries(recipients.map((item) => [item.id, item])), orderedIds: recipients.map((item) => item.id) },
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
  useEffect(() => { let cancelled = false; (async () => { try { await businessApi.establishSession(); const campaign = campaignId ? await businessApi.getCampaign(campaignId) : await businessApi.createCampaign(toServer(initialState)); if (!cancelled) { dispatch({ type: 'HYDRATE', campaign }); if (!campaignId) onCreated(campaign.campaignId); } } catch (error) { if (!cancelled) dispatch({ type: 'SAVE_ERROR', message: error.response?.status === 401 ? 'Sign in is required to save this draft.' : 'Draft could not be loaded.' }); } })(); return () => { cancelled = true; }; }, [campaignId, onCreated]);
  useEffect(() => { if (!state.sync.hydrated || !state.sync.dirty || !state.identity.campaignId) return undefined; const sequence = state.sync.changeSequence; const timer = window.setTimeout(async () => { try { const campaign = await businessApi.patchCampaign(state.identity.campaignId, toServer(latest.current)); dispatch({ type: 'SAVE_SUCCESS', campaign, sequence }); } catch (error) { dispatch({ type: 'SAVE_ERROR', message: error.response?.status === 409 ? 'A newer version exists. Refresh before continuing.' : 'Changes are not saved yet.' }); } }, 800); return () => window.clearTimeout(timer); }, [state.sync.hydrated, state.sync.dirty, state.sync.changeSequence, state.identity.campaignId, state.identity.revision]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
export function useCampaignStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useCampaignStudio must be used within CampaignStudioProvider');
  return value;
}
