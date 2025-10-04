import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChatContainer,
  ChatMessages,
  MessageBubble,
  ChatInputContainer,
  ChatInput,
  SendButton,
  QuickActionsContainer,
  QuickActionButton,
  EmptyStateContainer,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription
} from './styles/AgentPanelStyles';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatInterfaceProps {
  isCollapsed: boolean;
  onSendMessage?: (message: string) => void;
  isAgentTyping?: boolean;
  messages?: Message[];
  isConfigured?: boolean;
}

const QUICK_ACTIONS = [
  "Analyze my portfolio",
  "Find opportunities", 
  "Explain this tile",
  "Suggest purchases",
  "Check risks"
];

const ChatInterface = ({ 
  isCollapsed, 
  onSendMessage,
  isAgentTyping = false,
  messages = [],
  isConfigured = false
}: ChatInterfaceProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  const handleSendMessage = useCallback(() => {
    const trimmedMessage = inputMessage.trim();
    if (trimmedMessage && onSendMessage) {
      onSendMessage(trimmedMessage);
      setInputMessage('');
    }
  }, [inputMessage, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleQuickAction = useCallback((action: string) => {
    if (onSendMessage) {
      onSendMessage(action);
    }
  }, [onSendMessage]);

  if (isCollapsed) {
    return null;
  }

  return (
    <ChatContainer>
      <ChatMessages>
        {messages.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateIcon>🤖</EmptyStateIcon>
            <EmptyStateTitle>Ponziland AI Assistant</EmptyStateTitle>
            <EmptyStateDescription>
              I'm here to help you analyze lands, find opportunities, and optimize your strategy. 
              Ask me anything about the game!
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} $isUser={message.isUser}>
                {message.content}
              </MessageBubble>
            ))}
            {isAgentTyping && (
              <MessageBubble $isUser={false} $isTyping>
                Thinking
              </MessageBubble>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </ChatMessages>

      <ChatInputContainer>
        <ChatInput
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isConfigured ? "Ask me about Ponziland strategy..." : "Configure API key in Settings first..."}
          rows={1}
          disabled={!isConfigured}
        />
        <SendButton 
          $isDisabled={!inputMessage.trim() || isAgentTyping || !isConfigured}
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isAgentTyping || !isConfigured}
        >
          Send
        </SendButton>
      </ChatInputContainer>

      {isConfigured && (
        <QuickActionsContainer>
          {QUICK_ACTIONS.map((action) => (
            <QuickActionButton
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isAgentTyping}
            >
              {action}
            </QuickActionButton>
          ))}
        </QuickActionsContainer>
      )}
    </ChatContainer>
  );
};

export default ChatInterface;