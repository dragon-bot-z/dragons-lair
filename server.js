const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── App Routing (subfolders → separate services) ────────────────────
const APPS = {
  '/fire': process.env.DRAGONFIRE_URL || 'https://dragonfire.up.railway.app',
};

// ── Proxy to sub-apps (fetch-based) ─────────────────────────────────
for (const [route, target] of Object.entries(APPS)) {
  app.use(route, async (req, res) => {
    try {
      const targetUrl = new URL(req.originalUrl, target);
      const headers = { ...req.headers, host: new URL(target).host };
      delete headers['content-length'];
      
      const response = await fetch(targetUrl.href, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
        duplex: 'half',
      });
      
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      });
      
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
          return pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      console.error(`Proxy error for ${route}:`, err.message);
      res.status(502).send('Bad Gateway');
    }
  });
  console.log(`  ↳ ${route} → ${target}`);
}

// ── Serve static dashboard ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🐉 Dragon's Lair is live at http://localhost:${PORT}\n`);
});
