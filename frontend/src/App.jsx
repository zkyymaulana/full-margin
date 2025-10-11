import { useState } from "react";
import CandleChart from "./components/CandleChart";
import MarketcapTable from "./components/MarketTable";

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");

  const handleCoinSelect = (symbol) => {
    setSelectedSymbol(symbol);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-5xl p-4">
        <CandleChart symbol={selectedSymbol} />
        <br />
        <MarketcapTable
          onCoinSelect={handleCoinSelect}
          selectedSymbol={selectedSymbol}
        />
      </div>
    </div>
  );
}

export default App;
