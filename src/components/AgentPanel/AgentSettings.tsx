import { useState, useCallback } from 'react';

interface AgentConfig {
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

interface AgentSettingsProps {
  config: AgentConfig;
  onConfigChange: (config: Partial<AgentConfig>) => void;
  agentStatus: 'online' | 'thinking' | 'offline';
  error: string | null;
}

const AgentSettings = ({ config, onConfigChange, agentStatus, error }: AgentSettingsProps) => {
  const [showApiKey, setShowApiKey] = useState(false);

  const handleConfigChange = useCallback((field: keyof AgentConfig, value: any) => {
    onConfigChange({ [field]: value });
  }, [onConfigChange]);

  const settingsStyle = {
    height: '100%',
    overflowY: 'auto' as const,
    padding: '12px',
    color: 'white',
    fontSize: '11px'
  };

  const sectionStyle = {
    marginBottom: '12px',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    color: '#ccc',
    fontSize: '10px',
    fontWeight: 500
  };

  const inputStyle = {
    width: '100%',
    padding: '4px 6px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
    color: 'white',
    fontSize: '10px'
  };


  const checkboxStyle = {
    marginRight: '6px'
  };

  return (
    <div style={settingsStyle}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '12px' }}>🤖 Daydreams Agent Config</h4>

      {/* Status Section */}
      <div style={sectionStyle}>
        <h5 style={{ margin: '0 0 6px 0', color: '#4CAF50', fontSize: '10px' }}>Status</h5>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: agentStatus === 'online' ? '#4CAF50' : 
                       agentStatus === 'thinking' ? '#ff9800' : '#666666'
          }} />
          <span style={{ fontSize: '10px' }}>
            {agentStatus === 'online' ? 'Ready' : 
             agentStatus === 'thinking' ? 'Processing...' : 'Offline'}
          </span>
        </div>
        {error && (
          <div style={{ 
            background: 'rgba(255, 0, 0, 0.1)', 
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '4px',
            padding: '6px',
            fontSize: '10px',
            color: '#ff6b6b'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* AI Provider Section */}
      <div style={sectionStyle}>
        <h5 style={{ margin: '0 0 6px 0', color: '#3b82f6', fontSize: '10px' }}>🧠 AI Model</h5>
        
        <div style={{
          ...inputStyle,
          background: 'rgba(76, 175, 80, 0.1)',
          border: '1px solid rgba(76, 175, 80, 0.3)',
          color: '#4CAF50',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px'
        }}>
          <span>🧠</span>
          <span>Gemini 2.0 Flash</span>
          <span style={{ fontSize: '8px', color: '#888', marginLeft: 'auto' }}>via OpenRouter</span>
        </div>

        <label style={labelStyle}>API Key:</label>
        <div style={{ display: 'flex', gap: '3px' }}>
          <input
            type={showApiKey ? 'text' : 'password'}
            style={{ ...inputStyle, flex: 1 }}
            value={config.openrouterApiKey}
            onChange={(e) => handleConfigChange('openrouterApiKey', e.target.value)}
            placeholder="sk-or-..."
          />
          <button
            style={{
              padding: '4px 6px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '3px',
              color: 'white',
              fontSize: '10px',
              cursor: 'pointer'
            }}
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? '👁️' : '🔒'}
          </button>
        </div>
        <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Get API key →</a>
        </div>
      </div>

      {/* Starknet Configuration Section */}
      <div style={sectionStyle}>
        <h5 style={{ margin: '0 0 6px 0', color: '#ff6b35', fontSize: '10px' }}>🔗 Starknet Wallet</h5>
        
        <label style={labelStyle}>Address:</label>
        <input
          type="text"
          style={inputStyle}
          value={config.starknetAddress}
          onChange={(e) => handleConfigChange('starknetAddress', e.target.value)}
          placeholder="0x..."
        />

        <label style={{ ...labelStyle, marginTop: '6px' }}>Private Key:</label>
        <input
          type={showApiKey ? 'text' : 'password'}
          style={inputStyle}
          value={config.starknetPrivateKey}
          onChange={(e) => handleConfigChange('starknetPrivateKey', e.target.value)}
          placeholder="0x..."
        />

        <label style={{ ...labelStyle, marginTop: '6px' }}>RPC URL:</label>
        <input
          type="text"
          style={inputStyle}
          value={config.starknetRpcUrl}
          onChange={(e) => handleConfigChange('starknetRpcUrl', e.target.value)}
          placeholder="https://api.cartridge.gg/x/starknet/mainnet"
        />

        <label style={{ ...labelStyle, marginTop: '6px' }}>GraphQL URL:</label>
        <input
          type="text"
          style={inputStyle}
          value={config.graphqlUrl}
          onChange={(e) => handleConfigChange('graphqlUrl', e.target.value)}
          placeholder="https://api.cartridge.gg/x/ponziland-mainnet-world/torii/sql"
        />
      </div>

      {/* Trading Controls */}
      <div style={sectionStyle}>
        <h5 style={{ margin: '0 0 6px 0', color: '#22c55e', fontSize: '10px' }}>💰 Autonomous Trading</h5>
        
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={checkboxStyle}
            checked={config.autoTrading}
            onChange={(e) => handleConfigChange('autoTrading', e.target.checked)}
          />
          <span style={{ fontSize: '10px', fontWeight: 500, color: config.autoTrading ? '#4CAF50' : 'white' }}>
            Auto-buy profitable lands
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={checkboxStyle}
            checked={config.autoStaking}
            onChange={(e) => handleConfigChange('autoStaking', e.target.checked)}
          />
          <span style={{ fontSize: '10px', fontWeight: 500, color: config.autoStaking ? '#4CAF50' : 'white' }}>
            Auto-increase stakes (anti-nuke)
          </span>
        </label>
        <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>
          Chat with the agent to configure trading parameters and strategies
        </div>
      </div>

      {/* Quick Actions */}
      <div style={sectionStyle}>
        <h5 style={{ margin: '0 0 6px 0', color: '#8b5cf6', fontSize: '10px' }}>🔧 Actions</h5>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button 
            style={{
              padding: '3px 6px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '3px',
              color: 'white',
              fontSize: '9px',
              cursor: 'pointer'
            }}
            onClick={() => {
              onConfigChange({
                autoTrading: false,
                autoStaking: true,
                model: 'google/gemini-2.0-flash-001',
                starknetRpcUrl: 'https://api.cartridge.gg/x/starknet/mainnet',
                graphqlUrl: 'https://api.cartridge.gg/x/ponziland-mainnet-world/torii/sql'
              });
            }}
          >
            Defaults
          </button>
          <button 
            style={{
              padding: '3px 6px',
              background: config.openrouterApiKey && config.starknetAddress ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '3px',
              color: 'white',
              fontSize: '9px',
              cursor: 'pointer'
            }}
            onClick={() => {
              const issues = [];
              if (!config.openrouterApiKey) issues.push('API key');
              if (!config.starknetAddress) issues.push('Address');
              if (!config.starknetPrivateKey) issues.push('Private key');
              
              if (issues.length === 0) {
                alert('✅ Agent ready!');
              } else {
                alert(`⚠️ Missing: ${issues.join(', ')}`);
              }
            }}
          >
            Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentSettings;
