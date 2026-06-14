/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '@/common/config/configService';
import type { AgentSource } from '@/renderer/utils/model/agentTypes';

const AION_RUNTIME_AGENT = 'aionrs';
const FOUNDRY_LOCAL_AGENT_PRIORITY = ['codex', 'claude', 'cursor'];

type SelectableAgent = {
  agent_type: string;
  agent_source?: AgentSource;
  backend?: string;
  id?: string;
  is_preset?: boolean;
};

/** Save preferred mode to the agent's own config key */
export async function savePreferredMode(agentKey: string, mode: string): Promise<void> {
  try {
    if (agentKey === 'aionrs') {
      const config = configService.get('aionrs.config');
      await configService.set('aionrs.config', { ...config, preferredMode: mode });
    } else if (agentKey !== 'custom') {
      const config = configService.get('acp.config');
      const backendConfig = config?.[agentKey as string] || {};
      await configService.set('acp.config', { ...config, [agentKey]: { ...backendConfig, preferredMode: mode } });
    }
  } catch {
    /* silent */
  }
}

/** Save preferred model ID to the agent's acp.config key */
export async function savePreferredModelId(agentKey: string, model_id: string): Promise<void> {
  try {
    const config = configService.get('acp.config');
    const backendConfig = config?.[agentKey as string] || {};
    await configService.set('acp.config', { ...config, [agentKey]: { ...backendConfig, preferredModelId: model_id } });
  } catch {
    /* silent */
  }
}

/** Save default aionrs provider/model so the Guid page restores it next session. */
export async function saveAionrsDefaultModel(provider_id: string, use_model: string): Promise<void> {
  try {
    await configService.set('aionrs.defaultModel', { id: provider_id, use_model });
  } catch {
    /* silent */
  }
}

/**
 * Get agent key for selection.
 *
 * Rows that are row-scoped (custom ACP / remote agents) use `agent.id` directly
 * as the key — no namespace prefix. Builtin / internal agents keep `backend` or
 * `agent_type` as the key since there is only one row per type.
 *
 * Note: preset *assistants* (not agents) still use a `custom:<assistantId>`
 * form produced inline by `AssistantSelectionArea`. That is a separate
 * selection path that points at the backend-merged assistant catalog, not
 * `AgentRegistry`.
 */
export const getAgentKey = (agent: {
  agent_type: string;
  agent_source?: AgentSource;
  backend?: string;
  id?: string;
  is_preset?: boolean;
}): string => {
  const rowScoped = agent.agent_type === 'remote' || agent.agent_source === 'custom';
  if (rowScoped && agent.id) return agent.id;
  return agent.backend || agent.agent_type;
};

export function isAionRuntimeAgent(agent: Pick<SelectableAgent, 'agent_type' | 'backend'>): boolean {
  return agent.agent_type === AION_RUNTIME_AGENT || agent.backend === AION_RUNTIME_AGENT;
}

export function isLocalCliAgent(agent: SelectableAgent): boolean {
  return !agent.is_preset && !isAionRuntimeAgent(agent);
}

export function sortAgentsForFoundryDefault<T extends SelectableAgent>(agents: T[] | undefined): T[] {
  if (!agents) return [];

  return agents
    .map((agent, index) => ({ agent, index }))
    .sort((left, right) => {
      const leftRank = getFoundryAgentRank(left.agent);
      const rightRank = getFoundryAgentRank(right.agent);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.index - right.index;
    })
    .map(({ agent }) => agent);
}

export function getPreferredLocalAgent<T extends SelectableAgent>(agents: T[] | undefined): T | undefined {
  return sortAgentsForFoundryDefault(agents).find(isLocalCliAgent);
}

export function getPreferredAgentKey(agents: SelectableAgent[] | undefined): string {
  const preferredLocal = getPreferredLocalAgent(agents);
  if (preferredLocal) return getAgentKey(preferredLocal);

  const fallback = agents?.find((agent) => !agent.is_preset) ?? agents?.[0];
  return fallback ? getAgentKey(fallback) : AION_RUNTIME_AGENT;
}

function getFoundryAgentRank(agent: SelectableAgent): number {
  if (isAionRuntimeAgent(agent)) return 100;

  const backend = agent.backend ?? agent.agent_type;
  const priorityIndex = FOUNDRY_LOCAL_AGENT_PRIORITY.indexOf(backend);
  if (priorityIndex >= 0) return priorityIndex;

  if (agent.agent_source === 'custom') return 20;
  if (agent.agent_type === 'acp') return 30;

  return 50;
}
