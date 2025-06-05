# Ponziland ROI Map

An interactive grid-based visualization tool for the Ponziland blockchain game that helps players analyze ROI (Return on Investment) opportunities and strategic gameplay elements across a 64x64 land grid.

## Features

### Real-Time Data Visualization
- **Live Grid Map**: 64x64 interactive grid representing all Ponziland parcels
- **Real-Time Updates**: Data refreshes every 5 seconds from SQL APIs
- **Land Information**: Owner, level, coordinates, and financial metrics for each parcel

### Financial Analysis Tools
- **ROI Calculations**: Comprehensive analysis considering purchase price, tax yields, and net profit per hour
- **Multi-Token Support**: Fetches current token prices from `/api/price` and converts to nftSTRK baseline
- **Tax System Visualization**: 
  - Calculates tax paid to neighboring lands and tax received from them
  - Displays net profit or loss per hour from the tax system
  - Tax rates adjusted by land level and cardinal neighbors (2% base rate)

### Dynamic Visual Indicators
- **Color-Coded Tiles**: Based on profitability (green for profit, red for loss)
- **Opportunity Highlighting**: Visual indicators for high ROI investment opportunities  
- **Player Land Highlighting**: Distinct styling for user-owned lands when address is entered
- **Level Indicators**: Clear display of land upgrade levels

### Auction System Integration
- **Live Auction Tracking**: Real-time display of lands currently under auction
- **Auction Price Calculation**: Dynamic pricing with decay mechanism over 7-day auction period
- **Potential Yield Analysis**: Shows expected returns for auction purchases
- **Time Tracking**: Elapsed time since auction start and time remaining

### Staking & Risk Management
- **Stake Visualization**: Amount of tokens staked on each land parcel
- **Burn Rate Calculations**: Real-time calculation of token consumption rates
- **Nukable Warnings**: Critical alerts for lands with depleted or low stakes
- **Time Estimates**: Precise countdown until stake depletion

### Interactive Interface
- **Zoom Controls**: Adjustable zoom levels (50%-200%) for detailed analysis
- **Player Management**: Searchable player list with username resolution
- **Minimizable Panels**: Collapsible UI elements for cleaner viewing
- **Detailed Tile Info**: Click any tile for comprehensive financial breakdown
- **Direct Game Access**: Quick link to official Ponziland game

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
1. **Player Selection**: Use the "Players" panel (top-left) to select player addresses and highlight their owned lands on the grid
2. **Zoom Control**: Adjust zoom level (50%-200%) using the "Zoom" panel (bottom-right) for detailed analysis
3. **Token Prices**: Monitor current exchange rates in the "Token Prices" panel (top-right) - all prices convert to nftSTRK baseline

### Analyzing Land Tiles
Each tile displays comprehensive information at a glance:

**Regular Land Tiles:**
- **Coordinates & Level**: Grid position and upgrade level (L1-L5)
- **Profit/Hour**: Net token gain/loss displayed in tile header (green = profit, red = loss)
- **Pricing**: Listed sale price in original token + nftSTRK conversion
- **Tax Information**: Tax paid to neighbors | Tax received from neighbors
- **ROI Percentage**: Hourly return on investment at current market price
- **Staking Status**: Time remaining before stake depletion ("NUKABLE" warnings for critical levels)

**Auction Tiles:**
- **"AUCTION" Header**: Clearly marked auction status
- **Potential Yield**: Expected hourly returns if purchased
- **Current Price**: Real-time auction price with decay mechanism
- **ROI Calculation**: Investment return percentage for auction price
- **Time Elapsed**: Duration since auction started

### Advanced Features
- **Detailed Tile Info**: Click any tile for comprehensive financial breakdown in popup panel
- **Color-Coded Opportunities**: Visual indicators highlight high-ROI investment opportunities
- **Username Resolution**: Player addresses automatically resolve to usernames when available
- **Real-Time Updates**: All data refreshes every 5 seconds for live market analysis

### Quick Actions
- **Play Game**: Click "🎮 Play Ponziland" (bottom-left) to access the official game
- **Panel Management**: All UI panels can be minimized by clicking their headers

## Technical Overview

The Ponziland ROI Map is a single-page application (SPA) built with React and TypeScript, featuring a modular architecture for scalability and maintainability.

### Frontend Architecture (`src/` directory)
- **`components/PonzilandMap.tsx`**: Main component handling grid rendering, data fetching, and user interactions
- **`components/PonzilandMap/`**: Modular component structure with separated styling
  - `styles/MapStyles.ts`: Grid and map container styling
  - `styles/PanelStyles.ts`: UI panel and control styling  
  - `styles/TileStyles.ts`: Individual tile appearance and animations
- **`types/ponziland.ts`**: TypeScript interfaces for game data structures
- **`constants/ponziland.ts`**: Game constants (grid size, tax rates, auction parameters)
- **`utils/`**: Utility modules for different calculations
  - `formatting.ts`: Data formatting and display utilities
  - `dataProcessing.ts`: Grid data processing and organization
  - `taxCalculations.ts`: ROI, burn rate, and tax calculations
  - `auctionUtils.ts`: Auction price and timing calculations
  - `visualUtils.ts`: Color coding and visual indicator logic

### Backend APIs (`api/` directory)
- **`price.ts`**: Serverless function for fetching current token prices and exchange rates
- **`usernames.ts`**: Username resolution service for player addresses

### Data Flow
- **SQL API Integration**: Direct queries to Ponziland's SQL API for land, auction, and staking data
- **Real-Time Updates**: 5-second polling intervals for live data synchronization
- **Client-Side Processing**: All calculations (ROI, taxes, auction prices) performed in browser
- **Responsive UI**: Dynamic grid rendering with optimized performance for 64x64 grid

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
