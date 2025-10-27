# 📱 Telegram Notification Setup Guide

## 🎯 Fitur Utama

✅ **Anti-Spam**: Tidak mengirim notifikasi berulang untuk sinyal yang sama  
✅ **Single Indicator**: Notifikasi dari RSI, MACD, SMA, EMA  
✅ **Multi-Indicator**: Notifikasi dari kombinasi indikator dengan bobot optimal  
✅ **Auto-Scheduler**: Berjalan otomatis setiap penutupan candle (1 jam)  
✅ **Format Rapi**: Pesan terstruktur dengan emoji dan informasi lengkap

---

## 🚀 Cara Setup Telegram Bot

### Step 1: Buat Telegram Bot

1. Buka Telegram dan cari **@BotFather**
2. Kirim perintah `/newbot`
3. Berikan nama bot (contoh: `Crypto Trading Signal Bot`)
4. Berikan username bot (contoh: `crypto_signal_123_bot`)
5. Simpan **BOT TOKEN** yang diberikan (contoh: `6789012345:AAHdqT...`)

### Step 2: Dapatkan Chat ID

**Opsi A - Menggunakan Bot:**

1. Cari bot **@userinfobot** di Telegram
2. Kirim pesan `/start`
3. Bot akan mengirim **Chat ID** Anda

**Opsi B - Manual:**

1. Kirim pesan ke bot yang sudah dibuat
2. Buka browser dan akses:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Cari field `"chat":{"id": 123456789}` untuk mendapatkan Chat ID

### Step 3: Konfigurasi Environment Variables

Edit file `.env` di folder `backend/`:

```bash
# Telegram Notification Configuration
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=6789012345:AAHdqTxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
SIGNAL_MODE=multi   # Options: "single", "multi", "both"
```

**Signal Mode:**

- `single` = Hanya notifikasi single indicator (RSI, MACD, dll)
- `multi` = Hanya notifikasi multi-indicator optimized (Recommended ✅)
- `both` = Kedua jenis notifikasi (dapat menyebabkan spam)

---

## 🧪 Testing Telegram Notifications

### 1. Test Koneksi Telegram

```bash
GET http://localhost:8000/api/telegram/test
```

**Response:**

```json
{
  "success": true,
  "message": "Telegram test message sent successfully",
  "result": {
    "success": true,
    "messageId": 123
  }
}
```

### 2. Test Single Indicator Signal

```bash
GET http://localhost:8000/api/telegram/test-single/BTC-USD
```

**Response:**

```json
{
  "success": true,
  "symbol": "BTC-USD",
  "result": {
    "success": true,
    "signalsDetected": 2,
    "signalsSent": 2
  }
}
```

### 3. Test Multi-Indicator Signal

```bash
GET http://localhost:8000/api/telegram/test-multi/BTC-USD
```

**Response:**

```json
{
  "success": true,
  "symbol": "BTC-USD",
  "result": {
    "success": true,
    "signal": "buy",
    "score": 0.45
  }
}
```

### 4. Test Multiple Symbols

```bash
POST http://localhost:8000/api/telegram/test-all?mode=multi
Content-Type: application/json

{
  "symbols": ["BTC-USD", "ETH-USD", "SOL-USD"]
}
```

### 5. Clear Signal Cache

Jika ingin reset cache (untuk testing):

```bash
DELETE http://localhost:8000/api/telegram/cache?symbol=BTC-USD
```

Atau clear semua cache:

```bash
DELETE http://localhost:8000/api/telegram/cache
```

---

## 📊 Format Pesan Telegram

### Single Indicator Signal

```
🟢 BUY SIGNAL 🟢

📊 Symbol: BTC-USD
📈 Indicator: RSI
💰 Price: $67,234.50
📉 Value: 28.45
⏰ Timeframe: 1h
🕐 Time: 26/10/2025 14:00:00

Single Indicator Strategy
```

### Multi-Indicator Signal

```
🟢 BUY SIGNAL 🟢

📊 Symbol: BTC-USD
💰 Price: $67,234.50
⏰ Timeframe: 1h
🕐 Time: 26/10/2025 14:00:00

🎯 Active Indicators:
  • RSI: 3
  • SMA: 4
  • Stochastic: 4
  • BollingerBands: 3

📈 Performance:
  • ROI: 81.45%
  • Win Rate: 60.12%
  • Sharpe: 1.780
  • Trades: 472

Multi-Indicator Optimized Strategy
```

---

## 🔄 Automatic Signal Detection (Scheduler)

Sistem secara otomatis mendeteksi dan mengirim sinyal setiap jam!

**Schedule:**

- **Main Job**: Runs at **59th minute** setiap jam (sebelum candle close)
- **Backup Job**: Runs at **2nd minute** setiap jam (setelah candle close)

**Alur Kerja:**

1. ✅ Sync latest candle data dari Coinbase
2. ✅ Calculate technical indicators
3. ✅ **Detect signals dan kirim ke Telegram**
4. ✅ Update database

**Logs:**

```bash
🔔 Detecting and sending trading signals...
🎯 Detecting multi-indicator signals for BTC-USD...
✅ Sent multi-indicator buy signal for BTC-USD
📊 SIGNAL DETECTION SUMMARY:
   Multi:  5 success, 0 failed
✅ Signal detection and notification completed
```

---

## ⚙️ Advanced Configuration

### Disable Telegram Temporarily

```bash
TELEGRAM_ENABLED=false
```

### Change Signal Mode Without Restart

Update `.env`:

```bash
SIGNAL_MODE=both
```

Restart backend server untuk apply changes.

### Anti-Spam Mechanism

Sistem menggunakan **in-memory cache** untuk tracking sinyal terakhir:

- Jika sinyal sama dengan sebelumnya → **Skip** (tidak kirim)
- Jika sinyal berubah (BUY → SELL atau sebaliknya) → **Kirim**

**Cache Key Format:**

- Single: `{SYMBOL}_{INDICATOR}_single` (contoh: `BTC-USD_RSI_single`)
- Multi: `{SYMBOL}_multi` (contoh: `BTC-USD_multi`)

---

## 🐛 Troubleshooting

### ❌ "Telegram notifications disabled"

**Solusi:** Set `TELEGRAM_ENABLED=true` di `.env`

### ❌ "Telegram credentials not configured"

**Solusi:** Pastikan `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` sudah diisi di `.env`

### ❌ "Failed to send Telegram message: 401 Unauthorized"

**Solusi:** Bot token salah. Dapatkan token baru dari @BotFather

### ❌ "Failed to send Telegram message: 400 Bad Request"

**Solusi:** Chat ID salah. Pastikan sudah mengirim `/start` ke bot terlebih dahulu

### ⚠️ Tidak menerima notifikasi

**Checklist:**

1. ✅ Bot sudah di-start (`/start` di chat)
2. ✅ `TELEGRAM_ENABLED=true`
3. ✅ Token dan Chat ID benar
4. ✅ Scheduler berjalan (`GET /api/scheduler/status`)
5. ✅ Ada sinyal baru (bukan neutral)

---

## 📝 API Endpoints Summary

| Method | Endpoint                              | Description                  |
| ------ | ------------------------------------- | ---------------------------- |
| GET    | `/api/telegram/test`                  | Test Telegram connection     |
| GET    | `/api/telegram/test-single/:symbol`   | Test single indicator signal |
| GET    | `/api/telegram/test-multi/:symbol`    | Test multi-indicator signal  |
| POST   | `/api/telegram/test-all?mode={mode}`  | Test all symbols             |
| DELETE | `/api/telegram/cache?symbol={symbol}` | Clear signal cache           |

---

## 🎯 Best Practices

1. **Gunakan mode `multi`** untuk production (lebih akurat)
2. **Test dulu** sebelum enable di production
3. **Monitor logs** untuk memastikan sinyal terkirim
4. **Backup credentials** Telegram (token & chat ID)
5. **Jangan share token** dengan orang lain

---

## 📚 Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [Telegram Bot Tutorial](https://core.telegram.org/bots/tutorial)

---

## 🤝 Support

Jika ada masalah, cek:

1. Console logs backend
2. Test endpoint `/api/telegram/test`
3. Scheduler status `/api/scheduler/status`

---

**Created:** October 26, 2025  
**Version:** 1.0.0  
**Author:** Crypto Trading Bot Team
