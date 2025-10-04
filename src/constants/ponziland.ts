// Tax System Constants
export const TAX_RATE_RAW = 2; // Represents 2%
export const TIME_SPEED_FACTOR = 5;

// Grid Constants
export const GRID_SIZE = 256;

// Coordinate system (matches official ponziland contracts/helpers)
export const COORD_MULTIPLIER = 256; // 2^8, used to encode row in high bits
export const COORD_MASK = 0xff; // Low 8 bits for column
export const LOCATION_MASK = 0xffff; // 16-bit location index
export const MAX_NEIGHBOR_COUNT = 8;

// SQL API Configuration
export const SQL_API_URL = import.meta.env.VITE_SQL_API_URL;
export const PRICE_API_URL =
  import.meta.env.VITE_PRICE_API_URL ?? '/api/price';

// SQL Queries
export const SQL_GET_PONZI_LANDS = `SELECT location, token_used, sell_price, owner, level FROM "ponzi_land-Land"`;
export const SQL_GET_PONZI_LAND_AUCTIONS = `SELECT land_location, floor_price, start_time, start_price, is_finished FROM "ponzi_land-Auction"`;
export const SQL_GET_PONZI_CONFIG = `SELECT * FROM "ponzi_land-Config"`;
export const SQL_GET_PONZI_LANDS_STAKE = `SELECT location, amount FROM "ponzi_land-LandStake"`;

// Auction Constants
export const DECIMALS_FACTOR = 1_000_000_000_000_000_000n;
export const AUCTION_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds (604,800)
export const LINEAR_DECAY_TIME = 10 * 60 * 20; // 12,000 game seconds. With TIME_SPEED=5, this phase is 40 real-world minutes.
export const DROP_RATE = 90n; // 90% drop target over linear phase
export const RATE_DENOMINATOR = 100n; // For percentage calculations
export const SCALING_FACTOR = 50n;
export const TIME_SPEED = 5n; // Corrected to match contract

// Animation Constants
export const PULSE_ANIMATION = `
  @keyframes pulse {
    0% {
      box-shadow: 0 0 10px rgba(204, 102, 204, 1), 0 0 20px rgba(204, 102, 204, 0.5);
      border-color: rgba(204, 102, 204, 1);
    }
    50% {
      box-shadow: 0 0 15px rgba(204, 102, 204, 1), 0 0 30px rgba(204, 102, 204, 0.7);
      border-color: rgba(255, 182, 255, 1);
    }
    100% {
      box-shadow: 0 0 10px rgba(204, 102, 204, 1), 0 0 20px rgba(204, 102, 204, 0.5);
      border-color: rgba(204, 102, 204, 1);
    }
  }
`; 
