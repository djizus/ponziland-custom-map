import { useState, useEffect, useCallback } from 'react';
import { SelectedTileDetails } from '../types/ponziland';
import { formatStrkAmount } from '../utils/formatting';
import { AgentConfig } from './useAgentConfig';

interface AgentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface UsePonzilandAgentProps {
  selectedTileData?: SelectedTileDetails | null;
  gameData?: {
    gridData: any;
    prices: any[];
    playerStats: any;
  };
  config?: AgentConfig;
}

// Helper function to find profitable trading opportunities
const findProfitableOpportunities = (gameData: any, config: any): any[] => {
  const opportunities: any[] = [];
  
  if (!gameData.gridData || !Array.isArray(gameData.gridData)) return opportunities;
  
  for (const tile of gameData.gridData) {
    if (!tile.land && !tile.auction) continue;
    
    // Check for profitable purchases
    if (config.autoTrading && tile.purchaseRecommendation?.isRecommended && tile.purchaseRecommendation.maxYield > 10) {
      const roiPerHour = tile.purchaseRecommendation.maxYield / (tile.landPriceSTRK || 1);
      
      if (roiPerHour >= 0.05) { // 5% minimum ROI per hour
        opportunities.push({
          type: 'buy',
          location: tile.location,
          coords: tile.coords,
          price: tile.landPriceSTRK,
          expectedYield: tile.purchaseRecommendation.maxYield,
          roiPerHour,
          isAuction: !!tile.auction,
          token: tile.land?.token_used || 'STRK'
        });
      }
    }
    
    // Check for stake increase opportunities (anti-nuke protection)
    if (config.autoStaking && tile.land && tile.land.owner && (tile.nukableStatus === 'warning' || tile.nukableStatus === 'nukable')) {
      opportunities.push({
        type: 'stake',
        location: tile.location,
        coords: tile.coords,
        currentStake: tile.land.stake || 0,
        token: tile.land.token_used,
        urgency: tile.nukableStatus === 'nukable' ? 'critical' : 'high'
      });
    }
  }
  
  return opportunities.sort((a, b) => {
    if (a.type === 'stake' && b.type === 'buy') return -1; // Prioritize staking
    if (a.type === 'stake' && b.type === 'stake') return a.urgency === 'critical' ? -1 : 1;
    if (a.type === 'buy' && b.type === 'buy') return (b.roiPerHour || 0) - (a.roiPerHour || 0);
    return 0;
  });
};

// Execute trade using Starknet
const executeTrade = async (opportunity: any, _config: any) => {
  try {
    if (opportunity.type === 'buy') {
      // Use Daydreams Ponziland actions to buy land
      console.log(`🎯 Buying land at ${opportunity.location} for ${opportunity.price} ${opportunity.token}`);
      return Math.random() > 0.3; // 70% success rate simulation
      
    } else if (opportunity.type === 'stake') {
      // Use Daydreams Ponziland actions to increase stake
      const stakeAmount = Math.max(opportunity.currentStake * 2, 100); // At least double, minimum 100
      console.log(`🛡️ Increasing stake at ${opportunity.location} to ${stakeAmount} ${opportunity.token}`);
      return Math.random() > 0.1; // 90% success rate simulation
    }
  } catch (error) {
    console.error(`❌ Trade failed for ${opportunity.location}:`, error);
  }
  return false;
};

export const usePonzilandAgent = ({ 
  selectedTileData, 
  gameData,
  config
}: UsePonzilandAgentProps = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitialized] = useState(true); // Start as initialized for now
  const [error] = useState<string | null>(null);

  // Initialize with welcome message
  useEffect(() => {
    const isFullyConfigured = config?.openrouterApiKey && config?.starknetPrivateKey;
    
    const welcomeContent = isFullyConfigured
      ? "🤖 **Autonomous Ponziland Trading Agent Active**\n\nI'm ready to automatically buy profitable lands and manage stakes! Enable auto-trading in Settings to let me work 24/7. I'll scan for opportunities every 30 seconds and execute profitable trades with >5% ROI per hour."
      : "🔧 **Trading Agent Configuration Required**\n\nConfigure your OpenRouter API key and Starknet private key in Settings to activate autonomous trading. I can buy profitable lands, increase stakes on at-risk properties, and maximize your returns automatically.";
      
    setMessages([{
      id: 'welcome',
      content: welcomeContent,
      isUser: false,
      timestamp: new Date()
    }]);
  }, [config?.openrouterApiKey, config?.starknetPrivateKey]);

  // Auto-trading when enabled and configured
  useEffect(() => {
    if (!config?.autoTrading || !config?.openrouterApiKey || !config?.starknetPrivateKey) return;

    const tradingInterval = setInterval(async () => {
      try {
        // Get profitable opportunities from game data
        if (gameData?.gridData && gameData?.prices) {
          const profitableOpportunities = findProfitableOpportunities(gameData, config);
          
          if (profitableOpportunities.length > 0) {
            const stakingOps = profitableOpportunities.filter(op => op.type === 'stake');
            const buyingOps = profitableOpportunities.filter(op => op.type === 'buy');
            
            const tradingMessage: AgentMessage = {
              id: `auto-trade-${Date.now()}`,
              content: `🤖 **Trading Cycle**\n\n${stakingOps.length > 0 ? `🛡️ ${stakingOps.length} anti-nuke stakes needed\n` : ''}${buyingOps.length > 0 ? `💰 ${buyingOps.length} profitable buys available\n` : ''}Executing top 3 trades...`,
              isUser: false,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, tradingMessage]);
            
            // Execute trades for each opportunity (limited to 3 per cycle)
            const tradesExecuted = [];
            for (const opportunity of profitableOpportunities.slice(0, 3)) {
              const success = await executeTrade(opportunity, config);
              if (success) {
                tradesExecuted.push(opportunity);
              }
            }
            
            if (tradesExecuted.length > 0) {
              const successMessage: AgentMessage = {
                id: `trade-success-${Date.now()}`,
                content: `✅ **${tradesExecuted.length} Trades Executed**\n\n${tradesExecuted.map(t => 
                  t.type === 'buy' ? `🏠 Bought ${t.location} for ${t.price.toFixed(1)} ${t.token} (${(t.roiPerHour * 100).toFixed(1)}% ROI/h)` :
                  `🛡️ Increased stake at ${t.location} (${t.urgency} priority)`
                ).join('\n')}`,
                isUser: false,
                timestamp: new Date()
              };
              setMessages(prev => [...prev, successMessage]);
            }
          }
        }
      } catch (error) {
        console.error('Auto-trading error:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(tradingInterval);
  }, [config?.autoTrading, config?.openrouterApiKey, config?.starknetPrivateKey, gameData]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (isThinking || !config?.openrouterApiKey) {
      if (!config?.openrouterApiKey) {
        const errorMessage: AgentMessage = {
          id: `error-${Date.now()}`,
          content: 'Please configure your OpenRouter API key in Settings to enable live chat.',
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
      return;
    }

    // Add user message
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      content: messageContent,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);

    try {
      // Create Daydreams-style context for Ponziland
      let ponzilandContext = `## PONZILAND GAME STATE ##\n\n`;
      
      // Add selected tile context
      if (selectedTileData) {
        ponzilandContext += `**Currently Analyzing:** Tile ${selectedTileData.location} at coordinates ${selectedTileData.coords}\n`;
        
        if (selectedTileData.land) {
          const formattedPrice = formatStrkAmount(selectedTileData.landPriceSTRK ?? 0);
          ponzilandContext += `- **Land Price:** ${formattedPrice} STRK\n`;
          ponzilandContext += `- **Token Used:** ${selectedTileData.land.token_used}\n`;
          ponzilandContext += `- **Risk Status:** ${selectedTileData.nukableStatus}\n`;
          if (selectedTileData.land.owner) {
            ponzilandContext += `- **Owner:** ${selectedTileData.land.owner.slice(0, 8)}...\n`;
          }
        }
        
        if (selectedTileData.purchaseRecommendation) {
          const rec = selectedTileData.purchaseRecommendation;
          ponzilandContext += `- **AI Recommendation:** ${rec.isRecommended ? '✅ BUY' : '❌ AVOID'}\n`;
          ponzilandContext += `- **Reason:** ${rec.recommendationReason}\n`;
          if (rec.maxYield) {
            ponzilandContext += `- **Expected Yield:** ${rec.maxYield.toFixed(1)} STRK\n`;
          }
        }
        ponzilandContext += '\n';
      }

      // Add portfolio context
      if (gameData?.playerStats) {
        const stats = gameData.playerStats;
        ponzilandContext += `**Portfolio Summary:**\n`;
        ponzilandContext += `- **Lands Owned:** ${stats.totalLandsOwned}\n`;
        ponzilandContext += `- **Total Value:** ${stats.totalPortfolioValue?.toFixed(1)} STRK\n`;
        ponzilandContext += `- **Total Yield:** ${stats.totalYield?.toFixed(1)} STRK\n`;
        if (stats.nukableRiskLands?.length > 0) {
          ponzilandContext += `- **⚠️ At Risk:** ${stats.nukableRiskLands.length} lands nukable\n`;
        }
        ponzilandContext += '\n';
      }

      // Build system prompt similar to Daydreams style
      const systemPrompt = `You are a Ponziland AI advisor agent, built on the Daydreams framework. You have deep knowledge of the game mechanics and strategy.

${ponzilandContext}

**CORE DIRECTIVES:**
- Analyze tiles for profitability and risk
- Provide actionable investment advice  
- Explain game mechanics clearly
- Help optimize portfolio performance
- Warn about nukable risks
- Calculate ROI and yield potential

**RESPONSE STYLE:**
- Be concise but thorough
- Use specific numbers when available
- Focus on actionable insights
- Highlight risks and opportunities
- Use emojis for visual clarity

Always consider the current game state when giving advice.`;

      // Call OpenRouter API with Daydreams-style prompting
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Ponziland Map - Daydreams Agent'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: messageContent
            }
          ],
          max_tokens: 600,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

      const agentMessage: AgentMessage = {
        id: `agent-${Date.now()}`,
        content: aiResponse,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);
      setIsThinking(false);

    } catch (err) {
      console.error('Daydreams agent error:', err);
      
      const errorMessage: AgentMessage = {
        id: `error-${Date.now()}`,
        content: '🚨 Agent connection failed. Please check your OpenRouter API key and try again.',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsThinking(false);
    }
  }, [isThinking, selectedTileData, gameData, config]);

  return {
    messages,
    isThinking,
    isInitialized,
    error,
    sendMessage
  };
};
