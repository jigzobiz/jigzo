import React, { createContext, useContext, useMemo, useReducer } from 'react';

const recipients = [
  { id: 'sara', name: 'Sara Al Khalifa', nameAr: 'سارة آل خليفة', email: 'sara@atelier.co', phone: '+973 3600 2184', status: 'valid', source: 'imported', plusOne: 'inherit' },
  { id: 'omar', name: 'Omar Rahman', nameAr: 'عمر رحمن', email: 'omar@frame.studio', phone: '+973 3981 0922', status: 'valid', source: 'manual', plusOne: 'allow', message: 'Omar, save the evening — there is a seat with your name on it.', messageAr: 'عمر، احجز هذه الأمسية — هناك مقعد يحمل اسمك.' },
  { id: 'noor', name: 'Noor Hasan', nameAr: 'نور حسن', email: 'noor@example.com', phone: '360 18', status: 'invalid', source: 'imported', plusOne: 'inherit' },
  { id: 'sara-duplicate', name: 'Sara Al Khalifa', nameAr: 'سارة آل خليفة', email: 'sara@atelier.co', phone: '+973 3600 2184', status: 'duplicate', source: 'imported', plusOne: 'inherit' }
];

const initialState = {
  identity: { campaignId: null, organizationId: null, revision: null, status: 'local-draft' },
  studio: { activeArea: 0, visitedAreas: [0], selectedRecipientId: 'sara' },
  campaign: { name: 'The Atelier Opening', experienceType: 'invitation' },
  puzzle: { imagePreviewUrl: null, difficultyId: 'classic', mysteryMode: false },
  experience: { eventTitle: 'An evening at The Atelier', dateTime: '2026-10-24T19:30', timezone: 'Asia/Bahrain', location: 'The Atelier, Manama', rsvpDeadline: '2026-10-18', message: 'Sara, we would love you to join us for an intimate evening of art, conversation and a little surprise.', rsvpEnabled: true, allowPlusOneDefault: false },
  recipients: { entitiesById: Object.fromEntries(recipients.map((item) => [item.id, item])), orderedIds: recipients.map((item) => item.id) },
  delivery: { channel: 'whatsapp' }
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AREA': return { ...state, studio: { ...state.studio, activeArea: action.area, visitedAreas: [...new Set([...state.studio.visitedAreas, action.area])] } };
    case 'SET_FIELD': return { ...state, [action.section]: { ...state[action.section], [action.field]: action.value } };
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
export function CampaignStudioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
export function useCampaignStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useCampaignStudio must be used within CampaignStudioProvider');
  return value;
}
