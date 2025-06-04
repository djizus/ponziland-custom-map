# Ponziland ROI Map

An interactive map visualization tool for Ponziland that helps players analyze ROI (Return on Investment) opportunities and strategic gameplay elements across the game's land parcels.

## Features

- Real-time land data visualization, including owner, level, and coordinates.
- Comprehensive ROI calculation considering purchase price (in original token and normalized to nftSTRK), tax yields (paid and received), and net profit per hour.
- Multi-token price support: Fetches current token prices from `/api/price` and displays conversions to a common currency (e.g., nftSTRK).
- Dynamic Tile Styling:
    - Color-coded tiles based on profitability (positive/negative yield).
    - Visual indicators for high ROI opportunities.
    - Distinct styling for user-owned lands.
- Auction Insights:
    - Real-time display of lands currently under auction.
    - Calculation and display of current auction prices, incorporating a decay mechanism (linear and quadratic phases).
    - Potential yield display for auction tiles.
    - Elapsed time since auction start.
- Staking & "Nukable" Status:
    - Displays the amount of tokens staked on each land parcel.
    - Calculates and shows burn rate for staked tokens.
    - "Nukable" warnings for lands with low or depleted stake, including estimated time remaining before stake runs out.
- Tax System Visualization:
    - Calculates tax paid to neighboring lands and tax received from them.
    - Displays net profit or loss per hour from taxes.
    - Tax rates adjusted by land level and number of cardinal neighbors.
- Interactive User Interface:
    - Zoomable and pannable map interface.
    - Minimizable UI panels for address input, zoom controls, and token price display.
    - Input field to specify user's address for highlighting owned lands.
- Direct link to the official Ponziland game.

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

## Usage

- Enter your Ponziland address in the "Your Address" panel (top-left) to highlight your owned lands. This helps in quickly identifying your assets on the map.
- Use the zoom controls (bottom-right) to get a closer look at specific areas or a broader overview of the map.
- Monitor token prices and their conversion rates to nftSTRK in the "Token Prices" panel (top-right). This panel can be minimized.
- Analyze individual land tiles:
    - **Profit/Hour**: Displayed in the tile header, indicating net token gain or loss.
    - **Price**: Shows the listed sale price in its original token and converted to nftSTRK.
    - **Tax Info**: Details tax paid and received.
    - **ROI**: Hourly return on investment if you were to purchase the land at its current price.
    - **Staked Info**: Shows time remaining before staked tokens are depleted ("NUKABLE" or "⚠️ Time").
    - **Auction Tiles**: Display "AUCTION", potential yield, current price, and elapsed time.
- Click the "Play Ponziland" button (bottom-left) to navigate to the official game website.

## Technical Overview

The Ponziland ROI Map is a single-page application (SPA) built with React and TypeScript.

- **Frontend (`src/` directory)**:
    - `components/PonzilandMap.tsx`: The core React component responsible for rendering the map, fetching data, performing calculations, and handling user interactions.
    - `graphql/queries.ts`: Contains GraphQL queries used to fetch land, auction, and staking data from the Ponziland game's backend.
    - `types/`: Defines TypeScript interfaces for data structures like `PonziLand`, `PonziLandAuction`, etc.
    - `App.tsx`, `main.tsx`: Entry points for the React application.
    - `lib/`: (Assumed) May contain utility functions for calculations or data transformations.
    - `assets/`: For static files.
- **Backend API (`api/` directory)**:
    - `price.ts`: A serverless function (or similar backend endpoint) responsible for fetching and providing current token prices. This is queried by the frontend to ensure up-to-date price information for ROI and value calculations.

Data is fetched periodically to keep the map updated with the latest on-chain game state. Calculations for ROI, taxes, auction prices, and nukable status are performed client-side.

## Built With

- React
- TypeScript
- Vite
- Styled Components
- Apollo Client for GraphQL

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Links

- [Official Ponziland Game](https://play.ponzi.land/game)
