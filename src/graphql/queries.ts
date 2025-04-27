import { gql } from '@apollo/client';

export const GET_PONZI_LANDS = gql`
  query GetPonziLands {
    ponziLandLandModels(first: 4096) {
      edges {
        node {
          entity {
            id
          }
          location
          token_used
          sell_price
          owner
          level
        }
      }
      totalCount
    }
  }
`;

export const GET_PONZI_LAND_AUCTIONS = gql`
  query ponzi {
    ponziLandAuctionModels(first: 500) {
      edges {
        node {
          entity {
            id
          }
          land_location
          start_time
          start_price
          decay_rate
          is_finished
        }
      }
      totalCount
    }
  }
`;

export const GET_PONZI_LANDS_STAKE = gql`
  query GetPonziLandsStake {
    ponziLandLandStakeModels(first: 4096) {
      edges {
        node {
          entity {
            id
          }
          location
          amount
        }
      }
      totalCount
    }
  }
`; 