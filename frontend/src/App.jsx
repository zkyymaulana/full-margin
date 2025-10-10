import CandleChart from "./components/CandleChart";
import MarketcapTable from "./components/MarketTable";

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-5xl p-4">
        <h1 className="text-2xl font-bold mb-4">📊 BTC-USD Candle Chart</h1>
        <CandleChart symbol="BTC-USD" />
        <br />
        <MarketcapTable />
      </div>
    </div>
  );
}

export default App;
