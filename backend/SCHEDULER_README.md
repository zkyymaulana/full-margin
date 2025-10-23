# Crypto Analyze - Automated Scheduler System

## Overview

Sistem cron job otomatis untuk update candle data, perhitungan indikator, dan signal trading secara real-time.

## Timing Strategy

- **Main Job**: Menit ke-59 setiap jam (1 menit sebelum candle close)
- **Backup Job**: Menit ke-2 setiap jam (2 menit setelah candle close)
- **Health Check**: Setiap 5 menit
- **Symbols Refresh**: Setiap 30 menit

## API Endpoints

### Scheduler Management

#### 1. Start All Schedulers

```
POST /api/scheduler/start
Authorization: Bearer <token>
```

#### 2. Stop All Schedulers

```
POST /api/scheduler/stop
Authorization: Bearer <token>
```

#### 3. Get Scheduler Status

```
GET /api/scheduler/status
```

Response:

```json
{
  "success": true,
  "data": {
    "activeJobs": [
      "hourly-candle-sync",
      "backup-sync",
      "symbols-refresh",
      "health-check"
    ],
    "jobCount": 4,
    "stats": {
      "totalRuns": 45,
      "successfulRuns": 44,
      "failedRuns": 1,
      "lastRun": "2025-10-22T10:59:00.123Z",
      "lastRunDuration": 15420
    },
    "symbolsCache": {
      "count": 25,
      "lastRefresh": "2025-10-22T10:30:00.000Z",
      "symbols": ["BTC-USD", "ETH-USD", "ADA-USD"]
    },
    "uptime": 3600,
    "memoryUsage": {
      "rss": 125829120,
      "heapTotal": 89653248,
      "heapUsed": 67890432
    }
  }
}
```

#### 4. Manual Sync Trigger

```
POST /api/scheduler/sync
Authorization: Bearer <token>
```

#### 5. Calculate Indicators for Specific Symbol

```
POST /api/scheduler/indicators/{symbol}
Authorization: Bearer <token>
```

## Performance Features

### 1. Smart Scheduling

- **59th minute**: Fetch data 1 menit sebelum candle close
- **2nd minute**: Backup untuk data yang terlewat
- **Concurrency control**: Maksimal 3 symbol paralel untuk menghindari overload

### 2. Memory Management

- **Auto garbage collection** saat memory > 500MB
- **Symbols caching** untuk mengurangi database query
- **Connection pooling** untuk Coinbase API

### 3. Error Handling

- **Rate limit handling** dengan exponential backoff
- **Timeout protection** untuk API calls
- **Graceful degradation** saat ada error

### 4. Monitoring

- **Real-time stats** untuk success rate
- **Health checks** setiap 5 menit
- **Memory usage tracking**

## Environment Configuration

Tambahkan ke `.env`:

```bash
# Scheduler
SCHEDULER_TIMEZONE=Asia/Jakarta
SCHEDULER_AUTO_START=true

# Performance
INDICATORS_CONCURRENCY_LIMIT=3
SYMBOLS_CACHE_TTL=300000
MEMORY_THRESHOLD_MB=500

# Coinbase API
COINBASE_BATCH_SIZE=300
COINBASE_BATCH_DELAY_MS=400
COINBASE_RETRY_DELAY_MS=5000
```

## Usage

### Auto Start (Recommended)

Scheduler akan otomatis start saat aplikasi dijalankan:

```bash
npm start
```

### Manual Control

```bash
# Start schedulers
curl -X POST http://localhost:8000/api/scheduler/start \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl http://localhost:8000/api/scheduler/status

# Manual sync
curl -X POST http://localhost:8000/api/scheduler/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring Dashboard

Access scheduler status via:

- **API**: `GET /api/scheduler/status`
- **Logs**: Console output dengan emoji indicators
- **Memory**: Built-in memory usage tracking

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Auto garbage collection kicks in at 500MB
   - Restart application if persistent

2. **Failed API Calls**
   - Check Coinbase API status
   - Verify network connectivity
   - Review rate limits

3. **Missing Data**
   - Backup job runs every hour
   - Manual sync available via API
   - Check symbol configuration

### Log Indicators

- 🚀 System startup
- ⏰ Scheduled job start
- ✅ Successful operation
- ❌ Error occurred
- 🔄 Backup/retry operation
- 💖 Health check
- 🧹 Garbage collection
