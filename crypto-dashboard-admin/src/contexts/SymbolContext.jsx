import { createContext, useContext, useState, useEffect } from "react";

const SymbolContext = createContext();

export function SymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    // Get from localStorage or default to BTC-USD
    return localStorage.getItem("selectedSymbol") || "BTC-USD";
  });

  useEffect(() => {
    // Save to localStorage whenever symbol changes
    localStorage.setItem("selectedSymbol", selectedSymbol);
  }, [selectedSymbol]);

  const value = {
    selectedSymbol,
    setSelectedSymbol,
  };

  return (
    <SymbolContext.Provider value={value}>{children}</SymbolContext.Provider>
  );
}

export function useSymbol() {
  const context = useContext(SymbolContext);
  if (!context) {
    throw new Error("useSymbol must be used within a SymbolProvider");
  }
  return context;
}
