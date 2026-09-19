export function createInitialSession() {
  return {
    session_id: 'session-agent-a-001',
    repo_id: 'demo-checkout',
    component: 'checkoutService',
    error: 'Checkout request failed with timeout',
    agent: 'A',
    attempts: [],
    prior_fingerprints: [],
    analysis: null,
    recalled_memories: [],
    loop_detected: false,
    verification: '',
    memorySaveStatus: 'idle',
    loading: {
      attempt: false,
      analyze: false,
      memory: false,
      recall: false,
    },
    errors: {
      attempt: null,
      analyze: null,
      memory: null,
      recall: null,
    },
  }
}
