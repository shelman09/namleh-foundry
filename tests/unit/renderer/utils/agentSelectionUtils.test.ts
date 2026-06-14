import { describe, expect, it } from 'vitest';

import {
  getPreferredAgentKey,
  getPreferredLocalAgent,
  isAionRuntimeAgent,
  isLocalCliAgent,
  sortAgentsForFoundryDefault,
} from '@/renderer/pages/guid/hooks/agentSelectionUtils';

const agent = (backend: string, overrides: Record<string, unknown> = {}) => ({
  agent_type: backend === 'aionrs' ? 'aionrs' : 'acp',
  backend: backend === 'aionrs' ? undefined : backend,
  name: backend,
  ...overrides,
});

describe('Foundry agent selection defaults', () => {
  it('prefers Codex before Claude, Cursor, and the Aion runtime', () => {
    const agents = [agent('aionrs'), agent('gemini'), agent('claude'), agent('cursor'), agent('codex')];

    expect(sortAgentsForFoundryDefault(agents).map((a) => a.backend ?? a.agent_type)).toEqual([
      'codex',
      'claude',
      'cursor',
      'gemini',
      'aionrs',
    ]);
    expect(getPreferredAgentKey(agents)).toBe('codex');
  });

  it('falls back to Claude when Codex is unavailable', () => {
    const agents = [agent('aionrs'), agent('qwen'), agent('claude')];

    expect(getPreferredLocalAgent(agents)?.backend).toBe('claude');
    expect(getPreferredAgentKey(agents)).toBe('claude');
  });

  it('keeps the Aion runtime as the API-only fallback', () => {
    const agents = [agent('aionrs')];

    expect(isAionRuntimeAgent(agents[0])).toBe(true);
    expect(isLocalCliAgent(agents[0])).toBe(false);
    expect(getPreferredLocalAgent(agents)).toBeUndefined();
    expect(getPreferredAgentKey(agents)).toBe('aionrs');
  });

  it('uses row ids for custom local agents before falling back to Aion runtime', () => {
    const agents = [
      agent('aionrs'),
      agent('my-agent', {
        id: 'custom-agent-1',
        agent_source: 'custom',
      }),
    ];

    expect(getPreferredAgentKey(agents)).toBe('custom-agent-1');
  });
});
