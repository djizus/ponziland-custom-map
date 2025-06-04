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
  decay_rate: number;
  is_finished: boolean;
  floor_price?: string;
}

export interface PonziLandStake {
  location: string;
  amount: string;
}


export interface TokenPrice {
  symbol: string;
  address: string;
  ratio: number | null;
  best_pool: any;
}

export interface TaxInfo {
  taxPaid: number;
  taxReceived: number;
  profitPerHour: number;
}

export interface SelectedTileDetails {
  location: number;
  coords: string;
  land: PonziLand | null;
  auction: PonziLandAuction | null;
  taxInfo: TaxInfo;
  symbol: string;
  ratio: number | null;
  landPriceESTRK: number;
  valueColor: string;
  opportunityColor: string;
  isMyLand: boolean;
  burnRate: number;
  nukableStatus: 'nukable' | 'warning' | false;
  potentialYieldAuction?: number;
  auctionROI?: number;
}