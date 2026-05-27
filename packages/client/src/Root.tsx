import App from './App.tsx';
import { ReactFlowProvider } from '@xyflow/react';
import { HomeScreen } from '@screens/HomeScreen';
import { ResultsScreen } from '@screens/ResultsScreen';
import { useGameStore } from '@store';

export function Root() {
  const view = useGameStore(s => s.view);

  if (view === 'home') return <HomeScreen />;

  if (view === 'results') return <ResultsScreen />;

  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
