import axios from "axios";
import http from "http";
import https from "https";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const client = axios.create({
  timeout: 10000,
  httpAgent: new http.Agent({ family: 4, keepAlive: true }),
  httpsAgent: new https.Agent({ family: 4, keepAlive: true }),
});

(async () => {
  try {
    const coinbase = await client.get(
      "https://api.exchange.coinbase.com/products"
    );
    console.log("✅ Coinbase OK:", coinbase.status);

    const gecko = await client.get("https://api.coingecko.com/api/v3/ping");
    console.log("✅ CoinGecko OK:", gecko.data);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
