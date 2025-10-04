# 🤖 AI Agent Setup Guide

The Ponziland Map includes a powerful AI agent that can analyze tiles, provide strategic advice, and execute transactions on your behalf. Follow this guide to set it up.

## 📋 Required Configuration

### 1. OpenRouter API Key
Get access to 150+ AI models through OpenRouter:

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create an account and generate an API key
3. Add credits to your account ($5-10 recommended for testing)

### 2. Starknet Wallet Configuration
To enable transaction execution, provide your Starknet wallet details:

- **Wallet Address**: Your Starknet wallet address (starts with 0x...)
- **Private Key**: Your wallet's private key (keep this secure!)

### 3. Network Configuration (Pre-configured)
- **RPC URL**: `https://api.cartridge.gg/x/starknet/mainnet`
- **GraphQL URL**: `https://api.cartridge.gg/x/ponziland-mainnet-world/torii/sql`

## 🔧 Setup Methods

### Method 1: Environment Variables (Recommended)
Create a `.env` file in the project root:

```bash
# AI Configuration
VITE_OPENROUTER_API_KEY=your_api_key_here

# Starknet Configuration
VITE_STARKNET_ADDRESS=0x1234...
VITE_STARKNET_PRIVATE_KEY=your_private_key

# Network URLs (optional - defaults provided)
VITE_STARKNET_RPC_URL=https://api.cartridge.gg/x/starknet/mainnet
VITE_GRAPHQL_URL=https://api.cartridge.gg/x/ponziland-mainnet-world/torii/sql
```

### Method 2: Agent Settings Panel
1. Open the Ponziland Map
2. Click the 🤖 AI button in the bottom left
3. Go to **Settings** tab
4. Fill in the configuration sections:
   - **AI Configuration**: OpenRouter API key (Gemini 2.0 Flash model)
   - **Starknet Configuration**: Wallet address and private key
   - **Automation**: Auto-analyze and notification preferences

## 🎯 AI Model

The agent uses **Google Gemini 2.0 Flash** exclusively:

- **🧠 Google Gemini 2.0 Flash** - Latest multimodal AI model
  - ⚡ Lightning-fast responses
  - 🎯 Optimized for strategic analysis
  - 💰 Cost-effective pricing
  - 🔄 Real-time reasoning capabilities
  - 📊 Advanced mathematical computations for ROI analysis

## 🛡️ Security Best Practices

### Private Key Security:
- ⚠️ **Never share your private key**
- 🔒 Use environment variables when possible
- 💾 Keep backups in secure, encrypted storage
- 🚫 Don't commit keys to version control

### API Key Security:
- 🔑 Rotate API keys regularly
- 💰 Set spending limits on OpenRouter
- 📊 Monitor usage and costs
- 🚨 Revoke compromised keys immediately

## 🚀 Agent Capabilities

### Analysis Features:
- **Auto-tile Analysis**: Click any tile for instant AI evaluation
- **Portfolio Insights**: Comprehensive portfolio analysis
- **Risk Assessment**: Nukable land warnings and risk scoring
- **Strategy Recommendations**: Optimized buying/selling advice

### Transaction Features (When Configured):
- **Automated Purchases**: Execute land purchases within budget
- **Auction Bidding**: Strategic auction participation
- **Yield Management**: Automatic claiming and restaking
- **Portfolio Rebalancing**: Optimize holdings automatically

### Customization Options:
- **Auto-analyze**: Automatic tile analysis on selection
- **Notifications**: Opportunity and risk alerts
- **Automation Level**: From suggestions to full autonomy

## 🔧 Configuration Validation

Use the **Test Connection** button in settings to verify:
- ✅ OpenRouter API key is valid
- ✅ Starknet wallet configuration is complete
- ✅ Network connections are working
- ✅ Agent is ready for operation

## 💡 Tips for Best Results

### Agent Configuration:
1. **Start Simple**: Enable auto-analyze for tile insights
2. **Monitor Performance**: Review agent decisions regularly
3. **Adjust Gradually**: Increase automation as you gain confidence
4. **Use Notifications**: Stay informed of opportunities

### Cost Management:
1. **Gemini 2.0 Flash**: Already optimized for cost-effectiveness
2. **Set OpenRouter Limits**: Prevent unexpected charges  
3. **Monitor Usage**: Track costs in OpenRouter dashboard
4. **Use Auto-analyze Wisely**: Disable if not needed

## 🆘 Troubleshooting

### Common Issues:

**Agent Not Responding:**
- Check OpenRouter API key is valid
- Verify you have credits on OpenRouter
- Ensure Gemini 2.0 Flash is available on OpenRouter

**Tile Analysis Not Working:**
- Ensure "Auto-analyze tiles" is enabled in settings
- Check that you're clicking on valid tiles
- Verify the agent is online (green status)

**Transaction Features Unavailable:**
- Confirm Starknet address and private key are set
- Check RPC URL is accessible
- Verify wallet has sufficient funds

**Settings Not Saving:**
- Check browser localStorage is enabled
- Try exporting/importing configuration
- Clear browser cache if issues persist

## 📞 Support

For additional help:
- Review the **Activity** tab for recent agent actions
- Use the **Export Config** feature to backup settings
- Ask the agent directly in the **Chat** tab
- Report issues via the project's GitHub repository

---

⚡ **Ready to get started?** Open the agent settings and configure your OpenRouter API key to unlock the full power of AI-assisted Ponziland trading!
