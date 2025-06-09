# Ponziland ROI Map

An interactive grid-based visualization tool for the Ponziland blockchain game that helps players analyze ROI (Return on Investment) opportunities and strategic gameplay elements across a 64x64 land grid.

## Features

### Real-Time Data Visualization
- **Live Grid Map**: 64x64 interactive grid representing all Ponziland parcels
- **Real-Time Updates**: Data refreshes every 5 seconds from SQL APIs for background monitoring
- **Land Information**: Owner, level, coordinates, and financial metrics for each parcel

### Multi-Layer Analysis System
- **Analysis Layer**: Shows gross return (total yield + purchase price) with color-coded profitability
- **Purchasing Layer**: Displays net profit recommendations and hides non-recommended tiles automatically
- **Token Layer**: Filter and view only lands using a specific token (nftSTRK, USDC, etc.)

### Financial Analysis Tools
- **ROI Calculations**: Comprehensive analysis considering purchase price, tax yields, and net profit per hour
- **Purchase Recommendations**: Smart recommendations based on configurable holding duration (2-24 hours)
- **Multi-Token Support**: Fetches current token prices from `/api/price` and converts to nftSTRK baseline
- **Tax System Visualization**: 
  - Calculates tax paid to neighboring lands and tax received from them
  - Displays net profit or loss per hour from the tax system
  - Tax rates adjusted by land level and cardinal neighbors (2% base rate)

### Player Portfolio Analytics
- **Portfolio Stats**: Total lands owned, portfolio value, staked value, and total yield
- **Performance Metrics**: Identifies best and worst performing lands with clear location references
- **Risk Assessment**: Real-time alerts for lands close to being nukable (< 2 hours remaining)
- **Multi-Player Analysis**: Select multiple players to analyze combined portfolios

### Dynamic Visual Indicators
- **Color-Coded Tiles**: Based on profitability (green for profit, red for loss)
- **Smart Filtering**: Hide irrelevant tiles based on selected layer and criteria
- **Player Land Highlighting**: Distinct styling for user-owned lands when addresses are selected
- **Level Indicators**: Clear display of land upgrade levels

### Auction System Integration
- **Live Auction Tracking**: Real-time display of lands currently under auction
- **Auction Price Calculation**: Dynamic pricing with decay mechanism over 7-day auction period
- **Potential Yield Analysis**: Shows expected returns for auction purchases
- **Time Tracking**: Elapsed time since auction start and time remaining

### Staking & Risk Management
- **Stake Visualization**: Amount of tokens staked on each land parcel
- **Burn Rate Calculations**: Real-time calculation of token consumption rates
- **Nukable Warnings**: Critical alerts for lands with depleted or low stakes across entire portfolios
- **Time Estimates**: Precise countdown until stake depletion

### Enhanced User Interface
- **Non-Collapsible Sidebar**: Always-visible sidebar with proper alignment alongside the map
- **Responsive Design**: Sidebar and map positioned side-by-side without overlap
- **Action Buttons**: Quick access to both the game and GitHub repository
- **Detailed Tile Info**: Click any tile for comprehensive financial breakdown

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd ponziland-map
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173` (or your configured port).

## Usage Guide

### Getting Started
1. **Layer Selection**: Choose between Analysis, Purchasing, or Token layers to filter data
2. **Player Selection**: Select player addresses to highlight their lands and view portfolio analytics
3. **Token Analysis**: Use Token layer with dropdown to filter lands by specific tokens

### Multi-Layer Analysis
**Analysis Layer:**
- View gross return (total yield + purchase price) for all tiles
- Color-coded profitability visualization
- Best for general market overview

**Purchasing Layer:**
- Shows net profit recommendations with smart filtering
- Automatically hides non-recommended tiles
- Duration slider (2-24h) affects recommendation calculations
- Ideal for finding profitable purchase opportunities

**Token Layer:**
- Filter map to show only lands using selected token
- Token dropdown includes all available tokens (nftSTRK default)
- Same gross return calculations as Analysis layer
- Perfect for token-specific portfolio analysis

### Player Portfolio Analytics
When players are selected, view comprehensive stats:
- **Portfolio Overview**: Total lands, portfolio value, staked amounts, total yield
- **Performance Analysis**: Best/worst performing lands with locations
- **Risk Management**: Real-time alerts for lands at nukable risk (< 2h remaining)

### Land Tile Information
Each tile displays contextual information based on selected layer:

**Regular Land Tiles:**
- **Location & Level**: Coordinates in (x, y) format and upgrade level (L1-L5)
- **Value Display**: Gross return (Analysis/Token) or net profit (Purchasing)
- **Pricing**: Listed sale price in original token + nftSTRK conversion
- **Tax Information**: Tax paid to neighbors | Tax received from neighbors
- **ROI Percentage**: Hourly return on investment at current market price
- **Staking Status**: Time remaining before stake depletion with risk warnings

**Auction Tiles:**
- **"AUCTION" Header**: Clearly marked auction status with current price
- **Yield Analysis**: Expected returns based on selected layer
- **ROI Calculation**: Investment return percentage for current auction price
- **Time Information**: Duration since auction started and time remaining

### Advanced Features
- **Smart Filtering**: Irrelevant tiles automatically hidden based on layer selection
- **Portfolio Aggregation**: Multi-player analysis with combined statistics
- **Real-Time Risk Alerts**: Comprehensive nukable warnings across entire portfolios
- **Detailed Analysis**: Click any tile for in-depth financial breakdown
- **Username Resolution**: Player addresses automatically resolve to usernames when available

### Interface & Navigation
- **Always-Visible Sidebar**: Non-collapsible sidebar with proper map alignment
- **Dual Action Buttons**: Quick access to game (green) and GitHub repository (blue)
- **Responsive Layout**: Sidebar and map positioned side-by-side without overlap
- **Token Management**: Dynamic token selection with nftSTRK as default

## Technical Overview

The Ponziland ROI Map is a single-page application (SPA) built with React and TypeScript, featuring a modular architecture for scalability and maintainability.

### Frontend Architecture (`src/` directory)
- **`components/`**: Modular React components with TypeScript
  - `PonzilandMap.tsx`: Main orchestrator component with state management
  - `Sidebar.tsx`: Always-visible sidebar with layer controls and player stats
  - `GridRenderer.tsx`: Optimized grid rendering with memoization
  - `TileComponent.tsx`: Individual tile rendering with layer-specific logic
  - `ErrorBoundary.tsx`: Error handling and recovery
  - `PonzilandMap/styles/`: Styled components organization
- **`hooks/`**: Custom React hooks for data and state management
  - `useDataFetching.ts`: Background polling with 5-second intervals
  - `useGameData.ts`: Grid data processing and caching
  - `usePlayerManagement.ts`: Player selection and username resolution
  - `usePlayerStats.ts`: Portfolio analytics and risk assessment
  - `usePersistence.ts`: LocalStorage state persistence
- **`types/ponziland.ts`**: Comprehensive TypeScript interfaces and map layer types
- **`constants/ponziland.ts`**: Game constants (grid size, tax rates, auction parameters)
- **`utils/`**: Utility modules with performance optimizations
  - `calculationEngine.ts`: Consolidated calculation logic
  - `formatting.ts`: Data formatting and display utilities
  - `taxCalculations.ts`: ROI, burn rate, and tax calculations
  - `auctionUtils.ts`: Auction price and timing calculations
  - `visualUtils.ts`: Color coding and visual indicator logic
  - `performanceCache.ts`: Memoization and caching strategies

### Backend APIs (`api/` directory)
- **`price.ts`**: Serverless function for fetching current token prices and exchange rates
- **`usernames.ts`**: Username resolution service for player addresses

### Data Flow & Performance
- **SQL API Integration**: Direct queries to Ponziland's SQL API for land, auction, and staking data
- **Background Updates**: 5-second polling intervals regardless of user activity for live monitoring
- **Layer-Based Filtering**: Smart tile visibility based on selected analysis layer
- **Portfolio Aggregation**: Real-time multi-player statistics with risk assessment
- **Client-Side Processing**: All calculations (ROI, taxes, auction prices, player stats) in browser
- **Optimized Rendering**: Memoized components and efficient grid updates for 64x64 performance

## Built With

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Styled Components
- **State Management**: React Hooks (useState, useEffect)
- **Data Sources**: SQL API endpoints + REST APIs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Links

- [Official Ponziland Game](https://play.ponzi.land/game)
