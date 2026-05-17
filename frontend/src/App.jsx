import './index.css';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <div>
      <Navbar />
      <main style={{ padding: '40px 24px 0' }}>
        <Dashboard />
      </main>
    </div>
  );
}
