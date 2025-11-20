# 📱 Telegram Multi-User Notification System

## 📋 Overview

Sistem notifikasi Telegram multi-user memungkinkan setiap user untuk menerima trading signals secara personal di akun Telegram mereka masing-masing.

## 🔧 Perubahan yang Dilakukan

### 1. Database Schema

Ditambahkan 2 field baru pada model `User`:

- `telegramChatId` (String?) - Menyimpan Telegram Chat ID user
- `telegramEnabled` (Boolean) - Toggle untuk enable/disable notifikasi

### 2. API Endpoints Baru

#### **PATCH /api/users/:id/telegram**

Update Telegram settings untuk user tertentu.

**Request Body:**

```json
{
  "telegramChatId": "123456789",
  "telegramEnabled": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Telegram settings updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "telegramChatId": "123456789",
    "telegramEnabled": true
  }
}
```

#### **POST /api/telegram/webhook**

Webhook endpoint untuk menerima updates dari Telegram Bot.

**Supported Commands:**

- `/start` - Mendapatkan Chat ID
- `/connect <userId>` - Menghubungkan Telegram dengan akun user
- `/status` - Cek status koneksi

#### **POST /api/telegram/broadcast**

Broadcast pesan ke semua user yang mengaktifkan notifikasi.

**Request Body:**

```json
{
  "message": "🚀 Test broadcast message"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Broadcast completed",
  "result": {
    "sent": 5,
    "failed": 0,
    "total": 5,
    "errors": []
  }
}
```

#### **POST /api/telegram/broadcast-signal**

Broadcast trading signal ke semua user.

**Request Body:**

```json
{
  "symbol": "BTC-USD",
  "signal": "buy",
  "price": 45000,
  "type": "multi",
  "details": {
    "indicators": "RSI: 0.8, MACD: 0.7",
    "performance": "ROI: 15%, Win Rate: 65%"
  }
}
```

## 🚀 Setup Instructions

### Step 1: Setup Telegram Bot Webhook

Set webhook URL untuk bot Telegram Anda:

```bash
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook
```

**Contoh:**

```bash
https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://api.cryptobot.com/api/telegram/webhook
```

### Step 2: User Connect Telegram

Ada 2 cara untuk menghubungkan Telegram:

#### **Cara 1: Manual (Recommended)**

1. User membuka Telegram dan chat dengan bot Anda
2. User kirim `/start`
3. Bot akan reply dengan Chat ID
4. User copy Chat ID tersebut
5. User paste Chat ID di profile settings aplikasi web
6. Call API `PATCH /api/users/:id/telegram` dengan Chat ID

#### **Cara 2: Auto dengan Command**

1. User membuka Telegram dan chat dengan bot
2. User kirim `/connect <userId>` (contoh: `/connect 123`)
3. Bot otomatis update user di database
4. User langsung terhubung dan menerima notifikasi

### Step 3: Test Broadcast

Test broadcast ke semua user:

```bash
curl -X POST http://localhost:8000/api/telegram/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎯 Test broadcast to all users!"
  }'
```

## 💻 Code Usage Examples

### 1. Broadcast Trading Signal (Multi-User)

```javascript
import { broadcastTradingSignal } from "./services/telegram/telegram.service.js";

// Broadcast ke semua user yang enabled
await broadcastTradingSignal({
  symbol: "BTC-USD",
  signal: "buy",
  price: 45000,
  type: "multi",
  details: {
    indicators: "• RSI: 0.8\n• MACD: 0.7\n• SMA: 0.6",
    performance: "• ROI: 15%\n• Win Rate: 65%\n• Trades: 120",
  },
});
```

### 2. Broadcast Custom Message

```javascript
import { broadcastTelegram } from "./services/telegram/telegram.service.js";

await broadcastTelegram(`
🚨 *MARKET ALERT*

Bitcoin telah mencapai resistance level $50,000!

Monitor closely untuk breakout signal.
`);
```

### 3. Send to Specific User

```javascript
import { sendTelegramMessage } from "./services/telegram/telegram.service.js";

// Ambil user dari database
const user = await prisma.user.findUnique({
  where: { id: userId },
});

if (user.telegramEnabled && user.telegramChatId) {
  await sendTelegramMessage(
    "📊 Your personal trading update...",
    user.telegramChatId
  );
}
```

### 4. Integration dengan Signal Detection

```javascript
// Di signal-detection.service.js
import { broadcastTradingSignal } from "../telegram/telegram.service.js";

export async function detectAndNotifyAllSymbols(symbols, mode = "multi") {
  for (const symbol of symbols) {
    const signal = await detectSignal(symbol, mode);

    if (signal && (signal.type === "buy" || signal.type === "sell")) {
      // Broadcast ke semua user
      await broadcastTradingSignal({
        symbol,
        signal: signal.type,
        price: signal.price,
        type: mode,
        details: signal.details,
      });
    }
  }
}
```

## 📊 Database Migration

Migration sudah otomatis dibuat saat menjalankan:

```bash
npx prisma migrate dev --name add_telegram_fields_to_user
```

File migration ada di:

```
prisma/migrations/20251119155339_add_telegram_fields_to_user/migration.sql
```

## 🔒 Security Notes

1. **Webhook Security**: Webhook endpoint tidak memerlukan auth karena dipanggil langsung oleh Telegram
2. **User Settings**: User hanya bisa update Telegram settings mereka sendiri (checked via `req.user.id`)
3. **Chat ID Validation**: Pastikan Chat ID valid sebelum menyimpan
4. **Rate Limiting**: Broadcast memiliki delay 100ms antar pengiriman untuk menghindari rate limit Telegram

## 🧪 Testing

### Test Manual dengan Postman/cURL

1. **Update User Telegram Settings:**

```bash
curl -X PATCH http://localhost:8000/api/users/1/telegram \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramChatId": "123456789",
    "telegramEnabled": true
  }'
```

2. **Test Broadcast:**

```bash
curl -X POST http://localhost:8000/api/telegram/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test broadcast message!"
  }'
```

3. **Test Trading Signal Broadcast:**

```bash
curl -X POST http://localhost:8000/api/telegram/broadcast-signal \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC-USD",
    "signal": "buy",
    "price": 45000,
    "type": "multi"
  }'
```

## 📱 Telegram Bot Commands

### User Commands:

- `/start` - Get your Chat ID
- `/connect <userId>` - Connect Telegram to your account
- `/status` - Check connection status

### Example Flow:

```
User: /start
Bot: 👋 Welcome to Crypto Trading Bot!
     Your Chat ID: 123456789

     To enable notifications:
     1. Copy your Chat ID above
     2. Go to your profile settings
     3. Paste the Chat ID and enable notifications

User: /connect 5
Bot: ✅ Telegram Connected!
     Account: user@example.com
     Notifications: Enabled

     You'll now receive trading signals! 📊

User: /status
Bot: 📊 Your Status
     Email: user@example.com
     Notifications: ✅ Enabled
     Chat ID: 123456789
```

## 🔄 Migration from Single-User to Multi-User

Jika sebelumnya menggunakan single-user (TELEGRAM_CHAT_ID di .env):

1. **Backward Compatible**: Fungsi `sendTelegramMessage()` masih support chat ID default dari .env
2. **Migrate Existing Users**: Update users yang ingin menerima notifikasi:
   ```sql
   UPDATE "User"
   SET "telegramChatId" = 'YOUR_OLD_CHAT_ID',
       "telegramEnabled" = true
   WHERE email = 'admin@example.com';
   ```

## 🎯 Best Practices

1. **Always check `telegramEnabled`** sebelum kirim notifikasi
2. **Handle errors gracefully** - jika 1 user gagal, lanjutkan ke user berikutnya
3. **Use broadcast for general signals** - kirim ke semua user sekaligus
4. **Use specific messages for personal alerts** - kirim ke user tertentu saja
5. **Monitor broadcast results** - check `sent`, `failed`, dan `errors` dari response

## 📝 Environment Variables

Pastikan `.env` memiliki:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ENABLED=true
SIGNAL_MODE=multi
```

Note: `TELEGRAM_CHAT_ID` sekarang optional (hanya untuk backward compatibility)

## ✅ Checklist Implementation

- [x] Update Prisma schema dengan `telegramChatId` dan `telegramEnabled`
- [x] Create migration untuk database changes
- [x] Refactor `sendTelegramMessage()` untuk support dynamic chat ID
- [x] Implement `broadcastTelegram()` function
- [x] Implement `broadcastTradingSignal()` function
- [x] Add `PATCH /api/users/:id/telegram` endpoint
- [x] Add `POST /api/telegram/webhook` endpoint
- [x] Add `POST /api/telegram/broadcast` endpoint
- [x] Add `POST /api/telegram/broadcast-signal` endpoint
- [x] Update routes untuk semua endpoint baru
- [x] Add Telegram bot commands handler (/start, /connect, /status)
- [x] Add comprehensive documentation

## 🚨 Troubleshooting

**Problem**: Webhook tidak menerima updates
**Solution**: Pastikan webhook URL accessible dari internet dan valid HTTPS

**Problem**: Broadcast tidak terkirim ke user tertentu
**Solution**: Check apakah `telegramEnabled = true` dan `telegramChatId` tidak null

**Problem**: Bot tidak reply pesan
**Solution**: Check `TELEGRAM_BOT_TOKEN` di environment variables

**Problem**: User dapat "Forbidden" error saat update settings
**Solution**: Pastikan user hanya update settings mereka sendiri (user ID match)

---

**Created**: November 2024  
**Version**: 1.0.0  
**Author**: Crypto Trading Bot Team
