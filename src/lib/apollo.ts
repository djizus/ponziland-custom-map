import { ApolloClient, InMemoryCache } from '@apollo/client';

// Create the Apollo Client
export const client = new ApolloClient({
  uri: 'https://api.cartridge.gg/x/ponziland-tourney-2/torii/graphql',
  cache: new InMemoryCache(),
}); 