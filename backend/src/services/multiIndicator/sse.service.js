/**
 * 📡 Layanan Server-Sent Events (SSE)
 * ================================================================
 * Service untuk menangani real-time streaming events ke clients.
 *
 * Tanggung Jawab:
 * - Setup SSE headers dan configuration
 * - Mengirim events ke individual clients
 * - Broadcast events ke multiple clients
 * - Maintain heartbeat untuk keep-alive connection
 * ================================================================
 */

/**
 * 🔧 Setup SSE headers dan konfigurasi response untuk streaming
 *
 * @param {Object} res - Express response object
 * @returns {void}
 *
 * Menset headers:
 * - Content-Type: text/event-stream (required untuk SSE)
 * - Cache-Control: no-cache (tidak boleh cache)
 * - Connection: keep-alive (maintain koneksi)
 * - X-Accel-Buffering: no (disable nginx buffering)
 * - Content-Encoding: none (disable compression untuk SSE)
 */
export function setupSSE(res) {
  // ✅ Set SSE headers - CRITICAL untuk real-time streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // CORS headers (jika diperlukan)
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ✅ CRITICAL: Disable compression untuk SSE
  res.setHeader("Content-Encoding", "none");

  // ✅ Set response to unbuffered mode
  if (res.socket) {
    res.socket.setNoDelay(true);
    res.socket.setTimeout(0);
  }

  // ✅ Send headers immediately untuk langsung mulai streaming
  res.flushHeaders();

  console.log(`📡 [SSE] Headers setup complete`);
}

/**
 * 📤 Kirim event ke single client
 *
 * @param {Object} res - Express response object (SSE client)
 * @param {string} eventName - Nama event (e.g., "progress", "completed")
 * @param {Object} data - Data yang akan dikirim (akan di-stringify)
 * @returns {boolean} true jika sukses, false jika gagal
 *
 * Format SSE:
 * data: {JSON}\n\n
 *
 * Contoh:
 * data: {"type":"progress","tested":100,"total":390625}\n\n
 */
export function sendEvent(res, eventName, data) {
  try {
    const payload = JSON.stringify({
      type: eventName,
      ...data,
    });

    // ✅ Write data dalam format SSE
    res.write(`data: ${payload}\n\n`);

    // ✅ FORCE immediate transmission menggunakan socket
    // tanpa buffering untuk responsiveness real-time
    if (res.socket && !res.socket.destroyed) {
      res.socket.uncork?.();
    }

    console.log(`📤 [SSE] Event sent: ${eventName} (${payload.length} chars)`);
    return true;
  } catch (err) {
    console.error(`⚠️ [SSE] Error sending event:`, err.message);
    return false;
  }
}

/**
 * 📡 Broadcast event ke multiple clients
 *
 * @param {Set} clients - Set dari SSE clients (response objects)
 * @param {string} eventName - Nama event
 * @param {Object} data - Data yang akan di-broadcast
 * @returns {Object} Statistik broadcast {successCount, failCount}
 *
 * Mengirim event ke semua clients yang terhubung.
 * Jika client disconnect, akan dihapus dari set.
 */
export function broadcastEvent(clients, eventName, data) {
  if (!clients || clients.size === 0) {
    console.warn(`⚠️ [SSE-BROADCAST] Tidak ada clients untuk broadcast`);
    return { successCount: 0, failCount: 0 };
  }

  console.log(
    `📡 [SSE-BROADCAST] Broadcasting event: ${eventName} | Clients: ${clients.size}`
  );

  let successCount = 0;
  let failCount = 0;

  clients.forEach((client) => {
    try {
      const payload = JSON.stringify({
        type: eventName,
        ...data,
      });

      client.write(`data: ${payload}\n\n`);

      // ✅ CRITICAL: Force immediate transmission
      if (client.socket && !client.socket.destroyed) {
        client.socket.uncork?.();
      }

      successCount++;
    } catch (err) {
      console.error(
        `  ❌ [SSE-BROADCAST] Error broadcasting to client:`,
        err.message
      );
      clients.delete(client);
      failCount++;
    }
  });

  console.log(
    `📡 [SSE-BROADCAST] Result: ${successCount} success, ${failCount} failed\n`
  );

  return { successCount, failCount };
}

/**
 * 💓 Setup heartbeat untuk keep-alive connection
 *
 * @param {Object} res - Express response object
 * @param {number} intervalMs - Interval dalam milliseconds (default: 15000)
 * @returns {number} Timer ID untuk bisa di-clear nanti
 *
 * Mengirim comment heartbeat setiap interval untuk:
 * - Keep connection alive (prevent timeout)
 * - Detect broken connections
 * - Maintain state di proxies
 *
 * Format:
 * :heartbeat\n\n
 */
export function setupHeartbeat(res, intervalMs = 15000) {
  const heartbeatInterval = setInterval(() => {
    try {
      // Send comment (: prefix) sebagai heartbeat
      res.write(`:heartbeat\n\n`);

      if (res.socket && !res.socket.destroyed) {
        res.socket.uncork?.();
      }
    } catch (err) {
      // Jika error, stop heartbeat (client sudah disconnect)
      clearInterval(heartbeatInterval);
      console.log(`📡 [SSE] Heartbeat stopped (client disconnected)`);
    }
  }, intervalMs);

  console.log(`💓 [SSE] Heartbeat setup every ${intervalMs}ms`);
  return heartbeatInterval;
}

/**
 * 🔌 Close SSE connection dengan graceful
 *
 * @param {Object} res - Express response object
 * @param {Set} clients - Set dari clients (untuk cleanup)
 * @returns {void}
 */
export function closeSSE(res, clients) {
  try {
    if (clients) {
      clients.delete(res);
    }
    res.end();
    console.log(`🔌 [SSE] Connection closed`);
  } catch (err) {
    console.error(`⚠️ [SSE] Error closing connection:`, err.message);
  }
}

/**
 * 🔥 Close semua SSE connections
 *
 * @param {Set} clients - Set dari SSE clients
 * @returns {void}
 *
 * Digunakan saat:
 * - Optimization selesai
 * - Optimization dibatalkan
 * - Error terjadi
 */
export function closeAllSSE(clients) {
  if (!clients || clients.size === 0) {
    console.log(`📡 [SSE] No clients to close`);
    return;
  }

  console.log(`🔥 [SSE] Closing ${clients.size} SSE connections...`);

  let closedCount = 0;
  clients.forEach((client) => {
    try {
      client.end();
      closedCount++;
    } catch (err) {
      console.error(`⚠️ [SSE] Error closing client:`, err.message);
    }
  });

  clients.clear();
  console.log(`✅ [SSE] Closed ${closedCount} connections`);
}

export default {
  setupSSE,
  sendEvent,
  broadcastEvent,
  setupHeartbeat,
  closeSSE,
  closeAllSSE,
};
