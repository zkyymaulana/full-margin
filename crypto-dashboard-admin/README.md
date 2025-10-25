# Crypto Analyze Admin - React Version

Dashboard administrasi cryptocurrency yang dibangun dengan **React**, **TanStack Query**, **Axios**, dan **Tailwind CSS**.

## 🚀 Fitur

- ✅ **Authentication** - Login/Logout dengan JWT
- ✅ **Real-time Data** - Market cap live dengan auto-refresh
- ✅ **Interactive Charts** - Candlestick charts dengan lightweight-charts
- ✅ **Technical Indicators** - SMA, EMA, RSI, MACD, Bollinger Bands, dll
- ✅ **Comparison Analysis** - Perbandingan multiple indicators
- ✅ **Responsive Design** - Mobile-friendly dengan Tailwind CSS
- ✅ **React Router** - SPA navigation dengan protected routes
- ✅ **TanStack Query** - Data fetching & caching yang powerful

## 📦 Tech Stack

- **React 19** - UI Library
- **Vite 7** - Build tool & dev server
- **TanStack Query v5** - Data fetching & state management
- **Axios** - HTTP client
- **React Router v7** - Routing
- **Tailwind CSS v4** - Styling
- **Lightweight Charts** - Chart library

## 🛠️ Instalasi

1. **Clone repository**

```bash
git clone <repository-url>
cd crypto-dashboard-admin
```

2. **Install dependencies**

```bash
npm install
```

3. **Jalankan development server**

```bash
npm run dev
```

4. **Buka browser**

```
http://localhost:3000
```

## 📁 Struktur Folder

```
src/
├── components/          # React components
│   ├── Layout.jsx       # Main layout wrapper
│   ├── Header.jsx       # Top navigation header
│   ├── Sidebar.jsx      # Side navigation menu
│   └── Footer.jsx       # Footer component
├── pages/               # Page components
│   ├── Login.jsx        # Login page
│   ├── Dashboard.jsx    # Dashboard dengan chart & top coins
│   ├── Indicators.jsx   # Technical indicators page
│   ├── Comparison.jsx   # Indicator comparison page
│   ├── MarketCap.jsx    # Market cap overview
│   └── Settings.jsx     # User settings
├── hooks/               # Custom React hooks dengan TanStack Query
│   ├── useAuth.js       # Authentication hooks
│   ├── useCandles.js    # Chart data hooks
│   ├── useIndicators.js # Technical indicators hooks
│   ├── useMarketcap.js  # Market cap data hooks
│   └── useComparison.js # Comparison hooks
├── services/            # API services
│   └── api.service.js   # Axios HTTP client & API methods
├── App.jsx              # Main app component dengan routing
├── main.jsx             # Entry point
└── index.css            # Global styles & Tailwind
```

## 🔑 Authentication

Aplikasi menggunakan JWT authentication. Data user disimpan di `localStorage`:

- `authToken` - JWT token
- `userId` - User ID
- `userEmail` - User email
- `userName` - User name

## 🎯 API Endpoints

Base URL: `http://localhost:8000/api`

### Auth

- `POST /auth/login` - Login
- `POST /auth/logout` - Logout

### Market Data

- `GET /marketcap/live` - Live market cap data
- `GET /marketcap/symbol` - Available symbols
- `GET /chart/:symbol?timeframe=1h` - Candlestick data

### Indicators

- `GET /indicator/:symbol` - Single indicator
- `GET /multiIndicator/:symbol` - Multiple indicators

### Comparison

- `POST /comparison/compare` - Custom comparison
- `POST /comparison/quick` - Quick comparison
- `GET /comparison/indicators/:symbol` - Available indicators
- `GET /comparison/stats` - Comparison stats

## 🔄 Data Fetching dengan TanStack Query

Aplikasi menggunakan TanStack Query untuk data fetching dengan fitur:

- **Auto-refresh** - Market data refresh setiap 3 detik
- **Caching** - Data di-cache untuk mengurangi request
- **Optimistic Updates** - UI responsif dengan optimistic updates
- **Error Handling** - Automatic retry & error states

### Contoh Penggunaan Hook

```jsx
// Fetch market cap data (auto-refresh setiap 3s)
const { data, isLoading, error } = useMarketCapLive();

// Fetch candles dengan timeframe
const { data: candles } = useCandles("BTC-USD", "1h");

// Login mutation
const { mutate: login, isLoading } = useLogin();
login({ email, password });
```

## 🎨 Styling dengan Tailwind CSS

Aplikasi menggunakan Tailwind CSS v4 dengan custom components di `index.css`:

- **Card components** - `.card`, `.card-body`
- **Responsive layout** - Mobile-first design
- **Custom utilities** - Scroll styling, animations

## 📊 Charts

Charts menggunakan **lightweight-charts** library untuk performa optimal:

```jsx
import { createChart } from "lightweight-charts";

const chart = createChart(container, options);
const series = chart.addCandlestickSeries();
series.setData(candleData);
```

## 🔐 Protected Routes

Routes dilindungi dengan HOC `ProtectedRoute`:

```jsx
<Route
  path="/"
  element={
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  }
>
  <Route path="dashboard" element={<Dashboard />} />
  {/* ... */}
</Route>
```

## 📝 Scripts

```bash
# Development
npm run dev

# Build untuk production
npm run build

# Preview production build
npm run preview
```

## 🌐 Environment Variables

Ubah `API_BASE_URL` di `src/services/api.service.js`:

```javascript
const API_BASE_URL = "http://localhost:8000/api";
```

## 🤝 Kontribusi

1. Fork repository
2. Buat branch baru (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 License

MIT License

## 👨‍💻 Author

Crypto Analyze Admin - React Version

---

**Note**: Pastikan backend API sudah berjalan di `http://localhost:8000` sebelum menjalankan aplikasi ini.
