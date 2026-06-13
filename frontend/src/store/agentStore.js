import { create } from "zustand";

const useAgentStore = create((set, get) => ({
  sessions: {},
  activeSessionId: null,

  startSession: (sessionId, query) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { sessionId, query, status: "running", events: [], result: null },
      },
      activeSessionId: sessionId,
    }));
  },

  addEvent: (sessionId, event) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            events: [...session.events, { ...event, ts: Date.now() }],
          },
        },
      };
    });
  },

  completeSession: (sessionId, result) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, status: "completed", result },
        },
      };
    });
  },

  setApprovalRequired: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, status: "awaiting_approval" },
        },
      };
    });
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? sessions[activeSessionId] : null;
  },
}));

export default useAgentStore;
