/**
 * Programmatic Infographic Generator
 * 
 * Pipeline: AI structures data as JSON → Server renders HTML/CSS → Puppeteer captures as image
 * This guarantees 100% accurate text/numbers (no AI hallucination in rendering).
 */

import puppeteer from 'puppeteer-core';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

const CHROMIUM_PATH = '/usr/bin/chromium';
const TEMP_DIR = '/tmp';

/**
 * Infographic templates — each handles a different type of comparison/data visualization
 */
const TEMPLATES = {
  comparison: renderComparisonInfographic,
  stats: renderStatsInfographic,
  timeline: renderTimelineInfographic,
  ranking: renderRankingInfographic,
};

/**
 * Main entry: Generate an infographic from structured data
 * @param {object} data - Structured infographic data (from AI)
 * @param {string} template - Template type: comparison, stats, timeline, ranking
 * @returns {Buffer} PNG image buffer
 */
export async function generateInfographic(data, template = 'comparison') {
  const renderFn = TEMPLATES[template] || TEMPLATES.comparison;
  const html = renderFn(data);
  const imageBuffer = await htmlToImage(html, data.width || 1200, data.height || 1600);
  return imageBuffer;
}

/**
 * Convert HTML string to PNG image using Puppeteer
 */
async function htmlToImage(html, width = 1200, height = 1600) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for any web fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    return buffer;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Template: Side-by-side comparison (perfect for GOAT debates, product comparisons, etc.)
 */
function renderComparisonInfographic(data) {
  const {
    title = 'Comparison',
    subtitle = '',
    leftEntity = {},
    rightEntity = {},
    stats = [],
    theme = 'dark',
    accentColor = '#D4AF37',
  } = data;

  const bgColor = theme === 'dark' ? '#0f1419' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a2e';
  const mutedColor = theme === 'dark' ? '#8899a6' : '#666666';
  const cardBg = theme === 'dark' ? '#1a2332' : '#f8f9fa';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const statsRows = stats.map(stat => `
    <div class="stat-row">
      <div class="stat-value left ${stat.leftWins ? 'winner' : ''}">${stat.leftValue}</div>
      <div class="stat-label">
        <span class="stat-icon">${stat.icon || '•'}</span>
        <span>${stat.label}</span>
      </div>
      <div class="stat-value right ${stat.rightWins ? 'winner' : ''}">${stat.rightValue}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      padding: 60px 50px;
      min-height: 100vh;
    }
    .header {
      text-align: center;
      margin-bottom: 50px;
    }
    .header h1 {
      font-size: 42px;
      font-weight: 900;
      letter-spacing: -1px;
      background: linear-gradient(135deg, ${accentColor}, ${accentColor}dd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 16px;
      color: ${mutedColor};
      font-weight: 400;
    }
    .entities {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 50px;
      padding: 0 60px;
    }
    .entity {
      text-align: center;
      flex: 1;
    }
    .entity-avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${cardBg}, ${accentColor}22);
      border: 3px solid ${accentColor}44;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
    }
    .entity-name {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .entity-desc {
      font-size: 13px;
      color: ${mutedColor};
    }
    .vs-badge {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${accentColor};
      color: ${bgColor};
      font-weight: 800;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stats-container {
      background: ${cardBg};
      border-radius: 20px;
      padding: 40px;
      border: 1px solid ${borderColor};
    }
    .stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 0;
      border-bottom: 1px solid ${borderColor};
    }
    .stat-row:last-child {
      border-bottom: none;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 800;
      width: 140px;
      text-align: center;
    }
    .stat-value.left { text-align: right; padding-right: 30px; }
    .stat-value.right { text-align: left; padding-left: 30px; }
    .stat-value.winner { color: ${accentColor}; }
    .stat-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: ${mutedColor};
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .stat-icon {
      font-size: 20px;
      margin-bottom: 2px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 11px;
      color: ${mutedColor};
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  </div>
  
  <div class="entities">
    <div class="entity">
      <div class="entity-avatar">${leftEntity.emoji || '👤'}</div>
      <div class="entity-name">${leftEntity.name || 'Entity A'}</div>
      <div class="entity-desc">${leftEntity.description || ''}</div>
    </div>
    <div class="vs-badge">VS</div>
    <div class="entity">
      <div class="entity-avatar">${rightEntity.emoji || '👤'}</div>
      <div class="entity-name">${rightEntity.name || 'Entity B'}</div>
      <div class="entity-desc">${rightEntity.description || ''}</div>
    </div>
  </div>
  
  <div class="stats-container">
    ${statsRows}
  </div>
  
  <div class="footer">Generated by SoulPrint Engine • Data-accurate infographic</div>
</body>
</html>`;
}

/**
 * Template: Stats/metrics overview (for single entity breakdowns)
 */
function renderStatsInfographic(data) {
  const {
    title = 'Key Stats',
    subtitle = '',
    entity = {},
    metrics = [],
    theme = 'dark',
    accentColor = '#6366f1',
  } = data;

  const bgColor = theme === 'dark' ? '#0f1419' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a2e';
  const mutedColor = theme === 'dark' ? '#8899a6' : '#666666';
  const cardBg = theme === 'dark' ? '#1a2332' : '#f8f9fa';

  const metricCards = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-icon">${m.icon || '📊'}</div>
      <div class="metric-value">${m.value}</div>
      <div class="metric-label">${m.label}</div>
      ${m.sublabel ? `<div class="metric-sublabel">${m.sublabel}</div>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      padding: 60px 50px;
    }
    .header { text-align: center; margin-bottom: 50px; }
    .header h1 {
      font-size: 38px; font-weight: 900;
      background: linear-gradient(135deg, ${accentColor}, ${accentColor}cc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .header .subtitle { font-size: 15px; color: ${mutedColor}; margin-top: 8px; }
    .entity-header {
      text-align: center; margin-bottom: 40px;
    }
    .entity-header .emoji { font-size: 64px; margin-bottom: 12px; }
    .entity-header .name { font-size: 28px; font-weight: 700; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .metric-card {
      background: ${cardBg};
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .metric-icon { font-size: 28px; margin-bottom: 12px; }
    .metric-value { font-size: 36px; font-weight: 800; color: ${accentColor}; margin-bottom: 6px; }
    .metric-label { font-size: 13px; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }
    .metric-sublabel { font-size: 11px; color: ${mutedColor}; opacity: 0.7; margin-top: 4px; }
    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: ${mutedColor}; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  </div>
  ${entity.name ? `<div class="entity-header"><div class="emoji">${entity.emoji || ''}</div><div class="name">${entity.name}</div></div>` : ''}
  <div class="metrics-grid">${metricCards}</div>
  <div class="footer">Generated by SoulPrint Engine • Data-accurate infographic</div>
</body>
</html>`;
}

/**
 * Template: Timeline
 */
function renderTimelineInfographic(data) {
  const {
    title = 'Timeline',
    events = [],
    theme = 'dark',
    accentColor = '#10b981',
  } = data;

  const bgColor = theme === 'dark' ? '#0f1419' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a2e';
  const mutedColor = theme === 'dark' ? '#8899a6' : '#666666';

  const eventItems = events.map((e, i) => `
    <div class="timeline-item ${i % 2 === 0 ? 'left' : 'right'}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-year">${e.year || e.date || ''}</div>
        <div class="timeline-title">${e.title}</div>
        ${e.description ? `<div class="timeline-desc">${e.description}</div>` : ''}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: ${bgColor}; color: ${textColor}; padding: 60px 50px; }
  .header { text-align: center; margin-bottom: 50px; }
  .header h1 { font-size: 38px; font-weight: 800; color: ${accentColor}; }
  .timeline { position: relative; padding: 20px 0; }
  .timeline::before { content: ''; position: absolute; left: 50%; width: 2px; height: 100%; background: ${accentColor}33; }
  .timeline-item { display: flex; align-items: flex-start; margin-bottom: 30px; position: relative; }
  .timeline-dot { width: 14px; height: 14px; border-radius: 50%; background: ${accentColor}; position: absolute; left: calc(50% - 7px); top: 8px; z-index: 1; }
  .timeline-content { background: ${theme === 'dark' ? '#1a2332' : '#f8f9fa'}; border-radius: 12px; padding: 20px; width: 42%; border: 1px solid rgba(255,255,255,0.05); }
  .timeline-item.left .timeline-content { margin-right: auto; }
  .timeline-item.right .timeline-content { margin-left: auto; }
  .timeline-year { font-size: 12px; color: ${accentColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .timeline-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .timeline-desc { font-size: 13px; color: ${mutedColor}; }
  .footer { text-align: center; margin-top: 40px; font-size: 11px; color: ${mutedColor}; opacity: 0.6; }
</style></head><body>
  <div class="header"><h1>${title}</h1></div>
  <div class="timeline">${eventItems}</div>
  <div class="footer">Generated by SoulPrint Engine</div>
</body></html>`;
}

/**
 * Template: Ranking list
 */
function renderRankingInfographic(data) {
  const {
    title = 'Rankings',
    subtitle = '',
    items = [],
    theme = 'dark',
    accentColor = '#f59e0b',
  } = data;

  const bgColor = theme === 'dark' ? '#0f1419' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a2e';
  const mutedColor = theme === 'dark' ? '#8899a6' : '#666666';
  const cardBg = theme === 'dark' ? '#1a2332' : '#f8f9fa';

  const rankItems = items.map((item, i) => `
    <div class="rank-item">
      <div class="rank-num" style="background: ${i === 0 ? accentColor : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'transparent'}; color: ${i < 3 ? bgColor : mutedColor}">${i + 1}</div>
      <div class="rank-info">
        <div class="rank-name">${item.name}</div>
        ${item.description ? `<div class="rank-desc">${item.description}</div>` : ''}
      </div>
      <div class="rank-value">${item.value || ''}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: ${bgColor}; color: ${textColor}; padding: 60px 50px; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-size: 36px; font-weight: 800; color: ${accentColor}; }
  .header .subtitle { font-size: 14px; color: ${mutedColor}; margin-top: 8px; }
  .rank-item { display: flex; align-items: center; gap: 20px; padding: 20px 24px; background: ${cardBg}; border-radius: 14px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.05); }
  .rank-num { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; flex-shrink: 0; }
  .rank-info { flex: 1; }
  .rank-name { font-size: 18px; font-weight: 700; }
  .rank-desc { font-size: 12px; color: ${mutedColor}; margin-top: 2px; }
  .rank-value { font-size: 22px; font-weight: 800; color: ${accentColor}; }
  .footer { text-align: center; margin-top: 40px; font-size: 11px; color: ${mutedColor}; opacity: 0.6; }
</style></head><body>
  <div class="header"><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>
  ${rankItems}
  <div class="footer">Generated by SoulPrint Engine</div>
</body></html>`;
}

export { TEMPLATES, htmlToImage };
