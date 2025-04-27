import { ApolloProvider } from '@apollo/client';
import { client } from './lib/apollo';
import PonzilandMap from './components/PonzilandMap';
import './App.css';

function App() {
  return (
    <ApolloProvider client={client}>
      <PonzilandMap />
    </ApolloProvider>
  );
}

export default App;
