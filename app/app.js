const http = require('http');
const os   = require('os');

const PORT = process.env.PORT || 8080;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0b0d14;
    --surface: #13151f;
    --border: rgba(255,255,255,0.07);
    --accent: #6366f1;
    --accent2: #8b5cf6;
    --green: #22c55e;
    --text: #e2e8f0;
    --muted: #64748b;
  }

  body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }

  /* NAV */
  nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(11,13,20,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 40px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-logo { font-size: 17px; font-weight: 800; letter-spacing: -0.5px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 8px; }
  .nav-logo span { width: 28px; height: 28px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
  .nav-links { display: flex; gap: 6px; }
  .nav-link {
    text-decoration: none; color: var(--muted); font-size: 13px; font-weight: 500;
    padding: 6px 14px; border-radius: 8px; transition: color 0.2s, background 0.2s;
  }
  .nav-link:hover, .nav-link.active { color: #fff; background: rgba(255,255,255,0.07); }
  .nav-badge { background: var(--green); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-left: 4px; }

  /* HERO */
  .hero {
    padding: 80px 40px 60px;
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
  }
  .hero-eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .hero-eyebrow::before { content: ''; width: 24px; height: 2px; background: var(--accent); border-radius: 2px; }
  .hero h1 { font-size: clamp(32px, 5vw, 52px); font-weight: 800; line-height: 1.15; letter-spacing: -1px; margin-bottom: 20px; }
  .hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hero-sub { font-size: 16px; color: var(--muted); max-width: 520px; line-height: 1.7; margin-bottom: 36px; }
  .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .btn {
    text-decoration: none; padding: 11px 28px; border-radius: 10px;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
  .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { background: rgba(255,255,255,0.05); }
  .btn-sm { padding: 8px 20px; font-size: 13px; }

  /* STATS BAR */
  .stats-bar {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 28px 40px;
  }
  .stats-bar-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
  .stat-item { text-align: center; padding: 0 20px; border-right: 1px solid var(--border); }
  .stat-item:last-child { border-right: none; }
  .stat-num { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -1px; }
  .stat-num span { font-size: 16px; color: var(--accent); }
  .stat-desc { font-size: 12px; color: var(--muted); margin-top: 4px; }

  /* MAIN CONTENT */
  .main { max-width: 1100px; margin: 0 auto; padding: 60px 40px; width: 100%; flex: 1; }

  /* SECTION HEADING */
  .section-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--muted); margin-bottom: 24px; }

  /* CARDS GRID */
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 24px;
    transition: border-color 0.2s, transform 0.2s;
  }
  .card:hover { border-color: rgba(99,102,241,0.4); transform: translateY(-2px); }
  .card-icon { font-size: 22px; margin-bottom: 12px; }
  .card-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px; }
  .card-val { font-size: 22px; font-weight: 800; color: var(--accent); letter-spacing: -0.5px; }
  .card-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

  /* FEATURE GRID */
  .features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 40px; }
  .feature {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px;
    display: flex; gap: 16px; align-items: flex-start;
    transition: border-color 0.2s;
  }
  .feature:hover { border-color: rgba(99,102,241,0.3); }
  .feature-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(99,102,241,0.12); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .feature-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 5px; }
  .feature-desc { font-size: 13px; color: var(--muted); line-height: 1.6; }

  /* BADGE */
  .badge { display: inline-flex; align-items: center; gap: 5px; background: rgba(34,197,94,0.1); color: var(--green); border: 1px solid rgba(34,197,94,0.25); border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
  .badge::before { content: ''; width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: blink 1.5s ease-in-out infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* MEM BAR */
  .mem-wrap { background: rgba(255,255,255,0.05); border-radius: 999px; height: 6px; margin: 14px 0 6px; overflow: hidden; }
  .mem-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
  .mem-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }

  /* TECH TAGS */
  .tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .tag { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--muted); border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 500; }

  /* FOOTER */
  footer {
    border-top: 1px solid var(--border);
    padding: 24px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-brand { font-size: 13px; font-weight: 700; color: #fff; }
  .footer-copy { font-size: 12px; color: var(--muted); }
  .footer-links { display: flex; gap: 20px; }
  .footer-links a { font-size: 12px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
  .footer-links a:hover { color: #fff; }

  /* HEALTH PAGE */
  .status-hero { text-align: center; padding: 48px 0 36px; }
  .status-icon { font-size: 56px; margin-bottom: 16px; }
  .status-title { font-size: 36px; font-weight: 800; color: #fff; letter-spacing: -1px; margin-bottom: 8px; }
  .status-sub { font-size: 14px; color: var(--muted); }

  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  .main, .hero { animation: fadeUp 0.4s ease both; }
`;

function getStats() {
    const totalMem  = os.totalmem() / 1024 / 1024 / 1024;
    const freeMem   = os.freemem()  / 1024 / 1024 / 1024;
    const usedMem   = totalMem - freeMem;
    const memPct    = Math.round((usedMem / totalMem) * 100);
    const uptimeSec = os.uptime();
    const uptime    = uptimeSec < 3600
        ? Math.floor(uptimeSec / 60) + ' min'
        : Math.floor(uptimeSec / 3600) + ' hrs';
    return {
        hostname:    os.hostname(),
        time:        new Date().toLocaleString(),
        platform:    os.platform(),
        cpus:        os.cpus().length,
        totalMem:    totalMem.toFixed(1),
        freeMem:     freeMem.toFixed(1),
        usedMem:     usedMem.toFixed(1),
        memPct,
        uptime,
        nodeVersion: process.version,
    };
}

const server = http.createServer((req, res) => {
    const s = getStats();

    // ── /health/check — pure JSON for ALB health checks ──
    if (req.url === '/health/check') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'healthy', time: s.time }));
    }

    // ── /health — styled UI ──
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>System Status — CloudOps</title><style>${CSS}</style></head><body>
        <nav>
            <a href="/" class="nav-logo"><span>🚀</span> CloudOps</a>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="/health" class="nav-link active">Status</a>
                <a href="/info" class="nav-link">Server Info</a>
            </div>
        </nav>
        <div class="main">
            <div class="status-hero">
                <div class="status-icon">✅</div>
                <div class="status-title">All Systems Operational</div>
                <div class="status-sub" style="margin-top:10px"><span class="badge">Healthy</span></div>
                <div class="status-sub" style="margin-top:12px">${s.time}</div>
            </div>
            <div class="section-heading">System Metrics</div>
            <div class="cards">
                <div class="card"><div class="card-icon">⏱️</div><div class="card-title">Uptime</div><div class="card-val">${s.uptime}</div><div class="card-sub">Since last restart</div></div>
                <div class="card"><div class="card-icon">🖥️</div><div class="card-title">Hostname</div><div class="card-val" style="font-size:15px">${s.hostname}</div><div class="card-sub">${s.platform}</div></div>
                <div class="card"><div class="card-icon">⚡</div><div class="card-title">CPU Cores</div><div class="card-val">${s.cpus}</div><div class="card-sub">Available threads</div></div>
            </div>
            <div class="section-heading">Memory</div>
            <div class="card" style="margin-bottom:40px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:13px;color:var(--text)">Memory Usage</span>
                    <span style="font-size:13px;font-weight:700;color:var(--accent)">${s.memPct}%</span>
                </div>
                <div class="mem-wrap"><div class="mem-fill" style="width:${s.memPct}%"></div></div>
                <div class="mem-meta"><span>Used: ${s.usedMem} GB</span><span>Total: ${s.totalMem} GB</span></div>
            </div>
        </div>
        <footer>
            <span class="footer-brand">🚀 CloudOps</span>
            <div class="footer-links"><a href="/">Home</a><a href="/info">Server Info</a><a href="/health/check">JSON API</a></div>
            <span class="footer-copy">Node.js ${s.nodeVersion} · ECS Fargate</span>
        </footer>
        </body></html>`);
    }

    // ── /info ──
    if (req.url === '/info') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Server Info — CloudOps</title><style>${CSS}</style></head><body>
        <nav>
            <a href="/" class="nav-logo"><span>🚀</span> CloudOps</a>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="/health" class="nav-link">Status</a>
                <a href="/info" class="nav-link active">Server Info</a>
            </div>
        </nav>
        <div class="main">
            <div style="margin-bottom:32px">
                <div class="section-heading" style="margin-bottom:8px">Server Info</div>
                <h2 style="font-size:28px;font-weight:800;letter-spacing:-0.5px">Runtime Environment</h2>
                <p style="color:var(--muted);font-size:14px;margin-top:8px">Live system information from the ECS Fargate container.</p>
            </div>
            <div class="section-heading">Identity</div>
            <div class="cards" style="margin-bottom:32px">
                <div class="card"><div class="card-icon">🖥️</div><div class="card-title">Hostname</div><div class="card-val" style="font-size:14px;word-break:break-all">${s.hostname}</div></div>
                <div class="card"><div class="card-icon">💻</div><div class="card-title">Platform</div><div class="card-val">${s.platform}</div></div>
                <div class="card"><div class="card-icon">🟢</div><div class="card-title">Status</div><div class="card-val" style="font-size:14px"><span class="badge">Running</span></div></div>
            </div>
            <div class="section-heading">Performance</div>
            <div class="cards" style="margin-bottom:32px">
                <div class="card"><div class="card-icon">⚡</div><div class="card-title">CPU Cores</div><div class="card-val">${s.cpus}</div></div>
                <div class="card"><div class="card-icon">💾</div><div class="card-title">Total Memory</div><div class="card-val">${s.totalMem} <span style="font-size:14px;color:var(--muted)">GB</span></div></div>
                <div class="card"><div class="card-icon">⏱️</div><div class="card-title">Uptime</div><div class="card-val">${s.uptime}</div></div>
            </div>
            <div class="section-heading">Memory</div>
            <div class="card" style="margin-bottom:40px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:13px;color:var(--text)">Memory Usage</span>
                    <span style="font-size:13px;font-weight:700;color:var(--accent)">${s.memPct}%</span>
                </div>
                <div class="mem-wrap"><div class="mem-fill" style="width:${s.memPct}%"></div></div>
                <div class="mem-meta"><span>Used: ${s.usedMem} GB</span><span>Free: ${s.freeMem} GB</span></div>
            </div>
        </div>
        <footer>
            <span class="footer-brand">🚀 CloudOps</span>
            <div class="footer-links"><a href="/">Home</a><a href="/health">Status</a><a href="/health/check">JSON API</a></div>
            <span class="footer-copy">Node.js ${s.nodeVersion} · ECS Fargate</span>
        </footer>
        </body></html>`);
    }

    // ── 404 for unknown paths ──
    if (req.url !== '/') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Not found', path: req.url }));
    }

    // ── / home ──
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CloudOps — ECS Fargate Platform</title><style>${CSS}</style></head><body>
    <nav>
        <a href="/" class="nav-logo"><span>🚀</span> CloudOps</a>
        <div class="nav-links">
            <a href="/" class="nav-link active">Home</a>
            <a href="/health" class="nav-link">Status <span class="nav-badge">Live</span></a>
            <a href="/info" class="nav-link">Server Info</a>
        </div>
    </nav>

    <div class="hero">
        <div class="hero-eyebrow">ECS Fargate · GitHub Actions · Terraform</div>
        <h1>Deploy faster. No hands needed.<br><em>zero-touch deployments</em></h1>
        <p class="hero-sub">Fully automated CI/CD pipeline. Code flows from PR to production with health-check validation and automatic rollback in under 60 seconds.</p>
        <div class="hero-actions">
            <a href="/health" class="btn btn-primary">🟢 System Status</a>
            <a href="/info" class="btn btn-ghost">🖥️ Server Info</a>
        </div>
    </div>

    <div class="stats-bar">
        <div class="stats-bar-inner">
            <div class="stat-item"><div class="stat-num">${s.cpus}<span>x</span></div><div class="stat-desc">CPU Cores</div></div>
            <div class="stat-item"><div class="stat-num">${s.totalMem}<span>GB</span></div><div class="stat-desc">Total Memory</div></div>
            <div class="stat-item"><div class="stat-num">${s.memPct}<span>%</span></div><div class="stat-desc">Memory Used</div></div>
            <div class="stat-item"><div class="stat-num" id="uptime">${s.uptime}</div><div class="stat-desc">System Uptime</div></div>
        </div>
    </div>

    <div class="main">
        <div class="section-heading">Platform Features</div>
        <div class="features">
            <div class="feature"><div class="feature-icon">⚡</div><div><div class="feature-title">Instant Deployments</div><div class="feature-desc">Push to main and your code is live in minutes. No SSH, no manual steps, no surprises.</div></div></div>
            <div class="feature"><div class="feature-icon">🔄</div><div><div class="feature-title">Auto Rollback</div><div class="feature-desc">Health check fails? Pipeline rolls back to the previous task definition automatically.</div></div></div>
            <div class="feature"><div class="feature-icon">🛡️</div><div><div class="feature-title">Infrastructure as Code</div><div class="feature-desc">Every resource — VPC, ECS, ALB, IAM — is defined in Terraform modules with remote state.</div></div></div>
            <div class="feature"><div class="feature-icon">📊</div><div><div class="feature-title">Observability</div><div class="feature-desc">CloudWatch dashboards, alarms on CPU/memory, and SNS alerts keep you informed 24/7.</div></div></div>
        </div>

        <div class="section-heading">Live Server</div>
        <div class="cards" style="margin-bottom:40px">
            <div class="card"><div class="card-icon">🖥️</div><div class="card-title">Hostname</div><div class="card-val" style="font-size:14px;word-break:break-all">${s.hostname}</div><div class="card-sub">${s.platform}</div></div>
            <div class="card"><div class="card-icon">🟢</div><div class="card-title">Status</div><div class="card-val" style="font-size:14px"><span class="badge">Running</span></div><div class="card-sub">All systems normal</div></div>
            <div class="card"><div class="card-icon">🕒</div><div class="card-title">Server Time</div><div class="card-val" style="font-size:13px" id="clock">${s.time}</div><div class="card-sub">Local time</div></div>
        </div>

        <div class="section-heading">Tech Stack</div>
        <div class="tags">
            <span class="tag">Node.js ${s.nodeVersion}</span>
            <span class="tag">ECS Fargate</span>
            <span class="tag">GitHub Actions</span>
            <span class="tag">Terraform</span>
            <span class="tag">Docker</span>
            <span class="tag">AWS ALB</span>
            <span class="tag">CloudWatch</span>
            <span class="tag">${s.platform}</span>
        </div>
    </div>

    <footer>
        <span class="footer-brand">CloudOps</span>
        <div class="footer-links"><a href="/health">Status</a><a href="/info">Server Info</a><a href="/health/check">JSON API</a></div>
        <span class="footer-copy">Deployed via GitHub Actions → ECS Fargate</span>
    </footer>

    <script>setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleString(); }, 1000);</script>
    </body></html>`);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
