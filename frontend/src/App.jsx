import CandleChart from "./components/CandleChart";
import MarketcapTable from "./components/MarketTable";

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-5xl p-4">
        <CandleChart symbol="BTC-USD" />
        <br />
        <MarketcapTable />
      </div>
    </div>
  );
}

export default App;
