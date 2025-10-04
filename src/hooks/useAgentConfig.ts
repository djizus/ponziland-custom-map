import { useState, useEffect, useCallback } from 'react';

export interface AgentConfig {
  autoTrading: boolean;
  autoStaking: boolean;
  // AI Configuration
  openrouterApiKey: string;
  model: string;
  // Starknet Configuration
  starknetAddress: string;
  starknetPrivateKey: string;
  starknetRpcUrl: string;
  graphqlUrl: string;
}

// Helper to get environment variables with fallbacks
const getEnvVar = (keys: string[], fallback: string = '') => {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (value) return value;
  }
  return fallback;
};

const DEFAULT_CONFIG: AgentConfig = {
  autoTrading: false,
  autoStaking: true,
  // AI Configuration
  openrouterApiKey: getEnvVar(['VITE_OPENROUTER_API_KEY', 'REACT_APP_OPENROUTER_API_KEY']),
  model: 'google/gemini-2.0-flash-001',
  // Starknet Configuration
  starknetAddress: getEnvVar(['VITE_STARKNET_ADDRESS', 'REACT_APP_STARKNET_ADDRESS']),
  starknetPrivateKey: getEnvVar(['VITE_STARKNET_PRIVATE_KEY', 'REACT_APP_STARKNET_PRIVATE_KEY']),
  starknetRpcUrl: getEnvVar(['VITE_STARKNET_RPC_URL', 'REACT_APP_STARKNET_RPC_URL'], 'https://api.cartridge.gg/x/starknet/mainnet'),
  graphqlUrl: getEnvVar(
    ['VITE_GRAPHQL_URL', 'REACT_APP_GRAPHQL_URL'],
    'https://api.cartridge.gg/x/ponziland-mainnet-world/torii/sql'
  )
};

const CONFIG_KEY = 'ponziland-agent-config';

export const useAgentConfig = () => {
  const [config, setConfig] = useState<AgentConfig>(() => {
    // Load config from localStorage
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load agent config from localStorage:', error);
    }
    return DEFAULT_CONFIG;
  });

  // Save config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save agent config to localStorage:', error);
    }
  }, [config]);

  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const exportConfig = useCallback(() => {
    const configData = JSON.stringify(config, null, 2);
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ponziland-agent-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [config]);

  const importConfig = useCallback((configData: string) => {
    try {
      const parsed = JSON.parse(configData);
      setConfig({ ...DEFAULT_CONFIG, ...parsed });
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    exportConfig,
    importConfig
  };
};
