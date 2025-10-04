import styled from 'styled-components';

export const AgentPanelContainer = styled.div<{ $isCollapsed: boolean }>`
  position: sticky;
  top: 0;
  width: ${props => props.$isCollapsed ? '60px' : '400px'};
  height: 100vh;
  background: linear-gradient(135deg, 
    rgba(20, 20, 30, 0.95) 0%, 
    rgba(30, 30, 40, 0.9) 100%);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  backdrop-filter: blur(10px);
  z-index: 100;
  overflow: hidden;
`;

export const AgentPanelHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.2);
`;

export const AgentTitle = styled.h3`
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CollapseButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

export const AgentTabNavigation = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.1);
`;

export const AgentTabButton = styled.button<{ $isActive: boolean }>`
  flex: 1;
  padding: 12px 16px;
  background: ${props => props.$isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.$isActive ? '#4CAF50' : 'transparent'};
  color: ${props => props.$isActive ? '#ffffff' : '#cccccc'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }
`;

export const AgentTabContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
`;

export const ChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

export const MessageBubble = styled.div<{ $isUser: boolean; $isTyping?: boolean }>`
  padding: 12px 16px;
  border-radius: 16px;
  max-width: 85%;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  background: ${props => 
    props.$isUser 
      ? 'linear-gradient(135deg, #4CAF50, #45a049)' 
      : props.$isTyping 
        ? 'rgba(100, 100, 120, 0.3)'
        : 'rgba(255, 255, 255, 0.1)'
  };
  color: #ffffff;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
  position: relative;
  
  ${props => props.$isTyping && `
    &::after {
      content: '';
      display: inline-block;
      width: 4px;
      height: 4px;
      background: #ffffff;
      border-radius: 50%;
      margin-left: 8px;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 4px;
      background: #ffffff;
      border-radius: 50%;
      margin-right: 4px;
      animation: typing 1.4s infinite ease-in-out 0.2s;
    }
  `}

  @keyframes typing {
    0%, 60%, 100% {
      opacity: 0.3;
    }
    30% {
      opacity: 1;
    }
  }
`;

export const ChatInputContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-end;
`;

export const ChatInput = styled.textarea`
  flex: 1;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: white;
  font-size: 14px;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  overflow-y: auto;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  &:focus {
    outline: none;
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
  }

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
`;

export const SendButton = styled.button<{ $isDisabled: boolean }>`
  padding: 12px 16px;
  background: ${props => props.$isDisabled ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #4CAF50, #45a049)'};
  border: none;
  border-radius: 20px;
  color: white;
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 60px;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  }
`;

export const QuickActionsContainer = styled.div`
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: rgba(0, 0, 0, 0.1);
`;

export const QuickActionButton = styled.button`
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

export const AgentStatus = styled.div<{ $status: 'online' | 'thinking' | 'offline' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #cccccc;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => 
      props.$status === 'online' ? '#4CAF50' :
      props.$status === 'thinking' ? '#ff9800' : '#666666'
    };
    ${props => props.$status === 'thinking' && `
      animation: pulse 1.5s infinite ease-in-out;
    `}
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

export const EmptyStateContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  color: #cccccc;
`;

export const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

export const EmptyStateTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #ffffff;
`;

export const EmptyStateDescription = styled.p`
  margin: 0;
  font-size: 14px;
  opacity: 0.7;
  line-height: 1.4;
`;