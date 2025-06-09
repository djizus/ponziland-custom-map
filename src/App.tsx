import PonzilandMap from './components/PonzilandMap';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary context="APP_ROOT">
      <PonzilandMap />
    </ErrorBoundary>
  );
}

export default App;
