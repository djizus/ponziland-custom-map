import { ApolloClient, InMemoryCache } from '@apollo/client';

// Create the Apollo Client
export const client = new ApolloClient({
  uri: 'https://api.cartridge.gg/x/ponziland-tourney/torii/graphql',
  cache: new InMemoryCache(),
}); 