export interface PonziLand {
  entity: {
    id: string;
  };
  location: string;
  token_used: string;
  sell_price: string;
  owner: string;
  level: string;
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
  floor_price: string;
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