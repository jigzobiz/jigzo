import axios from 'axios';

const isLocalTest = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true';

// Base API URL configuration
const API = axios.create({
  baseURL: '',
  timeout: 10000,
});

/**
 * Fallback local storage helpers for offline/sandbox testing.
 */
const mockLocalStorage = {
  createPuzzle: (data) => {
    const publicId = 'test_' + Math.random().toString(36).substring(2, 10);
    const puzzle = { ...data, publicId, status: 'delivered', cropImageUrl: data.cropData };
    localStorage.setItem(`jigzo:test-puzzle`, JSON.stringify(puzzle));
    localStorage.setItem(`jigzo:puzzle:${publicId}`, JSON.stringify(puzzle));
    return { success: true, puzzle };
  },
  getPuzzle: (publicId) => {
    // Check specific puzzle or fallback to standard test puzzle
    const puzzleRaw = localStorage.getItem(`jigzo:puzzle:${publicId}`) || localStorage.getItem(`jigzo:test-puzzle`);
    if (!puzzleRaw) throw new Error('Puzzle not found in local sandbox.');
    const puzzle = JSON.parse(puzzleRaw);
    return {
      success: true,
      puzzle: {
        ...puzzle,
        publicId,
        recipients: (puzzle.recipients || []).map((r, i) => ({
          index: i,
          name: r.name,
          deliveryStatus: 'delivered',
          openedAt: r.openedAt || null,
          completedAt: r.completedAt || null,
          completionSeconds: r.completionSeconds || null
        }))
      }
    };
  },
  createOrder: (data) => {
    const orderId = 'ord_test_' + Math.random().toString(36).substring(2, 8);
    const total = (data.recipientCount <= 1 ? 5 : data.recipientCount <= 5 ? 8 : data.recipientCount <= 20 ? 15 : 25) + (data.hasRevealAlert ? (data.recipientCount <= 1 ? 1 : data.recipientCount <= 5 ? 1.5 : data.recipientCount <= 20 ? 2 : 2.5) : 0);
    return {
      success: true,
      order: {
        orderId,
        puzzleId: data.puzzleId,
        total,
        paymentStatus: 'pending',
        checkoutUrl: `http://localhost:5173/receive.html?test-payment=success&orderId=${orderId}&puzzleId=${data.puzzleId}`
      }
    };
  },
  recordOpen: (publicId, r) => {
    console.log(`[API Mock] Opened puzzle: ${publicId} by recipient ${r}`);
    return { success: true };
  },
  recordComplete: (publicId, r, duration) => {
    console.log(`[API Mock] Completed puzzle: ${publicId} by recipient ${r} in ${duration}s`);
    return { success: true };
  }
};

export const api = {
  createPuzzle: async (data) => {
    if (isLocalTest && !data.productionRun) {
      return mockLocalStorage.createPuzzle(data);
    }
    const response = await API.post('/api/puzzles', data);
    return response.data;
  },

  getPuzzle: async (publicId) => {
    if (isLocalTest && publicId.startsWith('test_')) {
      return mockLocalStorage.getPuzzle(publicId);
    }
    const response = await API.get(`/api/puzzles/${publicId}`);
    return response.data;
  },

  patchPuzzle: async (publicId, data) => {
    const response = await API.patch(`/api/puzzles/${publicId}`, data);
    return response.data;
  },

  createOrder: async (data) => {
    if (isLocalTest && !data.productionRun) {
      return mockLocalStorage.createOrder(data);
    }
    const response = await API.post('/api/orders', data);
    return response.data;
  },

  getOrder: async (orderId) => {
    const response = await API.get(`/api/orders/${orderId}`);
    return response.data;
  },

  recordOpen: async (publicId, recipientIndex = 0) => {
    if (isLocalTest && publicId.startsWith('test_')) {
      return mockLocalStorage.recordOpen(publicId, recipientIndex);
    }
    const response = await API.post(`/api/puzzles/${publicId}/open?r=${recipientIndex}`);
    return response.data;
  },

  recordComplete: async (publicId, recipientIndex = 0, durationSeconds = 0) => {
    if (isLocalTest && publicId.startsWith('test_')) {
      return mockLocalStorage.recordComplete(publicId, recipientIndex, durationSeconds);
    }
    const response = await API.post(`/api/puzzles/${publicId}/complete?r=${recipientIndex}`, { durationSeconds });
    return response.data;
  },

  // Simulated Webhook trigger for local payment testing
  triggerMockPayment: async (orderId, puzzleId) => {
    const response = await API.post('/api/webhooks/payment', {
      orderId,
      paymentStatus: 'success',
      paymentReference: 'ref_mock_local_test'
    }, {
      headers: {
        'x-jigzo-signature': 'sha256=mock_webhook_secret_key'
      }
    });
    return response.data;
  },

  registerLaunchInterest: async (email, phone, interestType, sourceUrl, context, anonymousId, sessionId) => {
    const response = await API.post('/api/interest', {
      email,
      phone,
      interestType,
      sourceUrl,
      context,
      anonymousId,
      sessionId
    });
    return response.data;
  }
};
