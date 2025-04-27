export interface PonziLand {
  entity: {
    id: string;
  };
  location: string;
  token_used: string;
  sell_price: string;
  owner: string;
  level: string;
  staked_amount?: string;
}

export interface PonziLandResponse {
  ponziLandLandModels: {
    edges: Array<{
      node: PonziLand;
    }>;
    totalCount: number;
  };
}

export interface PonziLandAuction {
  entity: {
    id: string;
  };
  land_location: number;
  start_time: string;
  start_price: string;
  decay_rate: string;
  is_finished: boolean;
}

export interface PonziLandAuctionResponse {
  ponziLandAuctionModels: {
    edges: Array<{
      node: PonziLandAuction;
    }>;
    totalCount: number;
  };
}

export interface PonziLandStake {
  entity: {
    id: string;
  };
  location: string;
  amount: string;
}

export interface PonziLandStakeResponse {
  ponziLandLandStakeModels: {
    edges: Array<{
      node: PonziLandStake;
    }>;
    totalCount: number;
  };
} 