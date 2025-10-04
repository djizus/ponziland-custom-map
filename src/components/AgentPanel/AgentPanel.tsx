import { useState, useCallback, useMemo } from 'react';
import ChatInterface from './ChatInterface';
import AgentSettings from './AgentSettings';
import AgentActivity from './AgentActivity';
import { usePonzilandAgent } from '../../hooks/usePonzilandAgent';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { SelectedTileDetails } from '../../types/ponziland';
import {
  AgentPanelContainer,
  AgentPanelHeader,
  AgentTitle,
  CollapseButton,
  AgentTabNavigation,
  AgentTabButton,
  AgentTabContent,
  AgentStatus
} from './styles/AgentPanelStyles';

interface AgentPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedTileData?: SelectedTileDetails | null;
  gameData?: {
    gridData: any;
    prices: any[];
    playerStats: any;
  };
  embedded?: boolean; // New prop to hide header when embedded in sidebar
}

type AgentTab = 'chat' | 'settings' | 'activity';

const AgentPanel = ({ isCollapsed, onToggleCollapse, selectedTileData, gameData, embedded = false }: AgentPanelProps) => {
  const [activeTab, setActiveTab] = useState<AgentTab>('chat');
  
  // Agent configuration
  const { config, updateConfig } = useAgentConfig();
  
  // Use the real Ponziland agent
  const { 
    messages, 
    isThinking: isAgentTyping, 
    isInitialized, 
    error,
    sendMessage 
  } = usePonzilandAgent({ selectedTileData, gameData, config });

  // Determine agent status based on initialization and activity
  const agentStatus: 'online' | 'thinking' | 'offline' = isAgentTyping 
    ? 'thinking' 
    : isInitialized 
      ? 'online' 
      : 'offline';

  // Tab configuration
  const tabs = useMemo(() => [
    { key: 'chat' as const, label: '💬 Chat', title: 'Chat with AI Agent' },
    { key: 'settings' as const, label: '⚙️ Settings', title: 'Agent Configuration' },
    { key: 'activity' as const, label: '📊 Activity', title: 'Recent Actions' }
  ], []);

  // Use the real agent's sendMessage function
  const handleSendMessage = useCallback((messageContent: string) => {
    sendMessage(messageContent);
  }, [sendMessage]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatInterface
            isCollapsed={isCollapsed}
            onSendMessage={handleSendMessage}
            isAgentTyping={isAgentTyping}
            messages={messages}
            isConfigured={!!config?.openrouterApiKey}
          />
        );
      case 'settings':
        return (
          <AgentSettings
            config={config}
            onConfigChange={updateConfig}
            agentStatus={agentStatus}
            error={error}
          />
        );
      case 'activity':
        return (
          <AgentActivity messages={messages} />
        );
      default:
        return null;
    }
  };

  // If embedded in sidebar, render without container and header
  if (embedded) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <AgentTabNavigation>
          {tabs.map(tab => (
            <AgentTabButton
              key={tab.key}
              $isActive={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.title}
            >
              {tab.label}
            </AgentTabButton>
          ))}
        </AgentTabNavigation>

        <AgentTabContent style={{ flex: 1 }}>
          {renderTabContent()}
        </AgentTabContent>
      </div>
    );
  }

  return (
    <AgentPanelContainer $isCollapsed={isCollapsed}>
      {!isCollapsed && (
        <>
          <AgentPanelHeader>
            <div>
              <AgentTitle>
                🤖 AI Agent
                <AgentStatus $status={agentStatus}>
                  {agentStatus}
                </AgentStatus>
              </AgentTitle>
            </div>
            <CollapseButton onClick={onToggleCollapse}>
              →
            </CollapseButton>
          </AgentPanelHeader>

          <AgentTabNavigation>
            {tabs.map(tab => (
              <AgentTabButton
                key={tab.key}
                $isActive={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                title={tab.title}
              >
                {tab.label}
              </AgentTabButton>
            ))}
          </AgentTabNavigation>

          <AgentTabContent>
            {renderTabContent()}
          </AgentTabContent>
        </>
      )}
      
      {isCollapsed && (
        <AgentPanelHeader>
          <CollapseButton onClick={onToggleCollapse} title="Open AI Agent">
            🤖
          </CollapseButton>
        </AgentPanelHeader>
      )}
    </AgentPanelContainer>
  );
};

export default AgentPanel;