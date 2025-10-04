export interface PonziLand {
  location: string;
  token_used: string;
  sell_price: string;
  owner: string;
  level: string;
  staked_amount?: string;
}

export interface PonziLandAuction {
  land_location: number;
  start_time: string;
  start_price: string;
  decay_rate?: string;
  is_finished: boolean;
  floor_price?: string;
}

export interface PonziLandStake {
  location: string;
  amount: string;
}

export interface PonziLandConfig {
  auction_duration?: number;
  base_time?: number;
  decay_rate?: number;
  drop_rate?: number;
  floor_price?: string;
  linear_decay_time?: number;
  liquidity_safety_multiplier?: number;
  price_decrease_rate?: number;
  rate_denominator?: number;
  scaling_factor?: number;
  tax_rate?: number;
  time_speed?: number;
}


export interface TokenPrice {
  symbol: string;
  address: string;
  ratio: number | null;
  tokenDecimals?: number;
  ratio_exact?: string;
  best_pool: any;
}

export interface TaxInfo {
  taxPaid: number;
  taxReceived: number;
  profitPerHour: number;
}

export interface YieldInfo {
  totalYield: number;
  yieldPerHour: number;
  taxPaidTotal: number;
}

export interface PurchaseRecommendation {
  currentPrice: number;
  maxYield: number;
  recommendedPrice: number;
  requiredTaxPerHour: number;
  requiredTotalTax: number;
  requiredStakeForFullYield: number;
  yieldDuration: number;
  neighborCount: number;
  isRecommended: boolean;
  recommendationReason: string;
  symbol: string;
  neighborDetails: Array<{
    location: number;
    priceESTRK: number;
    hourlyYield: number;
    timeRemaining: number;
    totalYieldFromThisNeighbor?: number;
    symbol: string;
  }>;
}

export type MapLayer = 'purchasing' | 'yield' | 'token';

export interface SelectedTileDetails {
  location: number;
  coords: string;
  land: PonziLand | null;
  auction: PonziLandAuction | null;
  taxInfo: TaxInfo;
  yieldInfo: YieldInfo;
  auctionYieldInfo?: YieldInfo;
  symbol: string;
  ratio: number | null;
  tokenDecimals?: number;
  landPriceSTRK: number;
  valueColor: string;
  isMyLand: boolean;
  burnRate: number;
  nukableStatus: 'nukable' | 'warning' | false;
  potentialYieldAuction?: number;
  auctionROI?: number;
  purchaseRecommendation?: PurchaseRecommendation;
  currentAuctionPriceSTRK?: number;
  auctionDurationSeconds?: number;
  stakedValueSTRK?: number;
  stakedTokenAmount?: number;
  timeRemainingHours?: number;
  saleTokenAmount?: number;
  grossReturn?: number;
}
