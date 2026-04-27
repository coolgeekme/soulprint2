/**
 * PDF Generator — Renders structured content as professional PDF documents
 * 
 * Pipeline: Structured JSON → HTML/CSS → Puppeteer → PDF buffer
 * Templates: report, summary, resume, invoice, conversation
 */

import puppeteer from 'puppeteer-core';

const CHROMIUM_PATH = '/usr/bin/chromium';

/**
 * Main entry: Generate a PDF from structured data
 * @param {object} data - Structured document data (from AI)
 * @param {string} template - Template type
 * @returns {Buffer} PDF buffer
 */
export async function generatePDF(data, template = 'report') {
  const renderFn = TEMPLATES[template] || TEMPLATES.report;
  const html = renderFn(data);
  const pdfBuffer = await htmlToPdf(html, data.options || {});
  return pdfBuffer;
}

/**
 * Convert HTML to PDF using Puppeteer
 */
async function htmlToPdf(html, options = {}) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || { top: '40px', right: '40px', bottom: '60px', left: '40px' },
      printBackground: true,
      displayHeaderFooter: options.showPageNumbers !== false,
      headerTemplate: '<div></div>',
      footerTemplate: options.showPageNumbers !== false 
        ? '<div style="font-size:9px;color:#999;width:100%;text-align:center;padding:10px 40px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        : '<div></div>',
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close();
  }
}

// ─── Base Styles ────────────────────────────────────────────────────────────

function baseStyles(accentColor = '#2563eb', fontFamily = "'Inter', -apple-system, sans-serif") {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${fontFamily}; font-size: 11pt; line-height: 1.6; color: #1a1a2e; }
    h1 { font-size: 24pt; font-weight: 800; color: ${accentColor}; margin-bottom: 8px; line-height: 1.2; }
    h2 { font-size: 16pt; font-weight: 700; color: #1a1a2e; margin-top: 24px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid ${accentColor}22; }
    h3 { font-size: 13pt; font-weight: 600; color: #333; margin-top: 18px; margin-bottom: 8px; }
    p { margin-bottom: 10px; color: #374151; }
    ul, ol { margin: 8px 0 12px 20px; }
    li { margin-bottom: 4px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
    th { background: ${accentColor}11; color: ${accentColor}; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 2px solid ${accentColor}33; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; }
    tr:nth-child(even) td { background: #f9fafb; }
    .accent { color: ${accentColor}; }
    .muted { color: #6b7280; font-size: 10pt; }
    .badge { display: inline-block; background: ${accentColor}15; color: ${accentColor}; font-size: 9pt; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    blockquote { border-left: 3px solid ${accentColor}; padding: 10px 16px; margin: 12px 0; background: ${accentColor}05; color: #4b5563; font-style: italic; }
    .page-break { page-break-before: always; }
  `;
}

// ─── Template: Report ────────────────────────────────────────────────────────

function renderReport(data) {
  const {
    title = 'Report',
    subtitle = '',
    author = '',
    date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    sections = [],
    accentColor = '#2563eb',
    executive_summary = '',
  } = data;

  const sectionsHtml = sections.map(section => {
    let content = '';
    if (section.content) content += `<p>${section.content.replace(/\n/g, '</p><p>')}</p>`;
    if (section.bullets) content += `<ul>${section.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
    if (section.table) {
      const headers = section.table.headers || [];
      const rows = section.table.rows || [];
      content += `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (section.subsections) {
      content += section.subsections.map(sub => `<h3>${sub.title}</h3><p>${(sub.content || '').replace(/\n/g, '</p><p>')}</p>${sub.bullets ? `<ul>${sub.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}`).join('');
    }
    return `<h2>${section.title}</h2>${content}`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(accentColor)}
    .cover { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${accentColor}; }
    .meta { display: flex; gap: 20px; margin-top: 12px; }
    .meta-item { font-size: 10pt; color: #6b7280; }
    .exec-summary { background: ${accentColor}08; border: 1px solid ${accentColor}22; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .exec-summary h3 { color: ${accentColor}; margin-top: 0; }
  </style></head><body>
    <div class="cover">
      <h1>${title}</h1>
      ${subtitle ? `<p class="muted" style="font-size:13pt;margin-top:4px;">${subtitle}</p>` : ''}
      <div class="meta">
        ${author ? `<span class="meta-item">By ${author}</span>` : ''}
        <span class="meta-item">${date}</span>
      </div>
    </div>
    ${executive_summary ? `<div class="exec-summary"><h3>Executive Summary</h3><p>${executive_summary}</p></div>` : ''}
    ${sectionsHtml}
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p class="muted">Generated by SoulPrint Engine</p>
    </div>
  </body></html>`;
}

// ─── Template: Executive Summary ─────────────────────────────────────────────

function renderSummary(data) {
  const {
    title = 'Executive Summary',
    subtitle = '',
    date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    overview = '',
    key_points = [],
    metrics = [],
    recommendations = [],
    conclusion = '',
    accentColor = '#7c3aed',
  } = data;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(accentColor)}
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid ${accentColor}33; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .metric-card { background: ${accentColor}08; border: 1px solid ${accentColor}22; border-radius: 8px; padding: 14px; text-align: center; }
    .metric-value { font-size: 20pt; font-weight: 800; color: ${accentColor}; }
    .metric-label { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .key-points { background: #f8fafc; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    .rec-item { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
    .rec-num { background: ${accentColor}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; flex-shrink: 0; }
  </style></head><body>
    <div class="header">
      <h1>${title}</h1>
      ${subtitle ? `<p class="muted" style="font-size:12pt;">${subtitle}</p>` : ''}
      <p class="muted">${date}</p>
    </div>
    ${overview ? `<p style="font-size:12pt;color:#374151;margin-bottom:20px;">${overview}</p>` : ''}
    ${metrics.length ? `<div class="metrics-grid">${metrics.map(m => `<div class="metric-card"><div class="metric-value">${m.value}</div><div class="metric-label">${m.label}</div></div>`).join('')}</div>` : ''}
    ${key_points.length ? `<h2>Key Points</h2><div class="key-points"><ul>${key_points.map(p => `<li><strong>${p.title || ''}</strong> ${p.detail || p}</li>`).join('')}</ul></div>` : ''}
    ${recommendations.length ? `<h2>Recommendations</h2>${recommendations.map((r, i) => `<div class="rec-item"><div class="rec-num">${i+1}</div><div><p>${r}</p></div></div>`).join('')}` : ''}
    ${conclusion ? `<h2>Conclusion</h2><p>${conclusion}</p>` : ''}
    <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;"><p class="muted">Generated by SoulPrint Engine</p></div>
  </body></html>`;
}

// ─── Template: Resume / CV ───────────────────────────────────────────────────

function renderResume(data) {
  const {
    name = 'Your Name',
    title: jobTitle = '',
    contact = {},
    summary = '',
    experience = [],
    education = [],
    skills = [],
    certifications = [],
    accentColor = '#0f766e',
  } = data;

  const contactLine = [contact.email, contact.phone, contact.location, contact.linkedin].filter(Boolean).join(' • ');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(accentColor, "'Inter', sans-serif")}
    body { padding: 0; }
    .resume-header { text-align: center; padding: 30px 40px 20px; border-bottom: 3px solid ${accentColor}; }
    .resume-header h1 { font-size: 28pt; color: #1a1a2e; margin-bottom: 4px; }
    .resume-header .title { font-size: 13pt; color: ${accentColor}; font-weight: 500; }
    .resume-header .contact { font-size: 10pt; color: #6b7280; margin-top: 8px; }
    .resume-body { padding: 20px 40px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${accentColor}; border-bottom: 1px solid ${accentColor}33; padding-bottom: 4px; margin-bottom: 12px; }
    .exp-item { margin-bottom: 14px; }
    .exp-header { display: flex; justify-content: space-between; align-items: baseline; }
    .exp-role { font-weight: 700; font-size: 11pt; }
    .exp-company { color: ${accentColor}; font-weight: 500; }
    .exp-date { font-size: 9pt; color: #6b7280; }
    .exp-bullets { margin: 4px 0 0 16px; }
    .exp-bullets li { font-size: 10pt; margin-bottom: 3px; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill-tag { background: ${accentColor}10; color: ${accentColor}; font-size: 9pt; font-weight: 500; padding: 3px 10px; border-radius: 4px; }
    .edu-item { margin-bottom: 10px; }
  </style></head><body>
    <div class="resume-header">
      <h1>${name}</h1>
      ${jobTitle ? `<div class="title">${jobTitle}</div>` : ''}
      ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
    </div>
    <div class="resume-body">
      ${summary ? `<div class="section"><div class="section-title">Summary</div><p>${summary}</p></div>` : ''}
      ${experience.length ? `<div class="section"><div class="section-title">Experience</div>${experience.map(exp => `
        <div class="exp-item">
          <div class="exp-header">
            <div><span class="exp-role">${exp.role}</span> <span class="exp-company">at ${exp.company}</span></div>
            <span class="exp-date">${exp.dates || ''}</span>
          </div>
          ${exp.bullets ? `<ul class="exp-bullets">${exp.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}</div>` : ''}
      ${education.length ? `<div class="section"><div class="section-title">Education</div>${education.map(edu => `
        <div class="edu-item">
          <div style="display:flex;justify-content:space-between;">
            <div><strong>${edu.degree}</strong> — ${edu.school}</div>
            <span class="exp-date">${edu.dates || ''}</span>
          </div>
          ${edu.details ? `<p class="muted">${edu.details}</p>` : ''}
        </div>`).join('')}</div>` : ''}
      ${skills.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills-grid">${skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div></div>` : ''}
      ${certifications.length ? `<div class="section"><div class="section-title">Certifications</div><ul>${certifications.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
    </div>
  </body></html>`;
}

// ─── Template: Invoice / Proposal ────────────────────────────────────────────

function renderInvoice(data) {
  const {
    type = 'Invoice',
    number = `INV-${Date.now().toString().slice(-6)}`,
    date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    due_date = '',
    from = {},
    to = {},
    items = [],
    notes = '',
    subtotal = '',
    tax = '',
    total = '',
    accentColor = '#1d4ed8',
  } = data;

  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center;">${item.quantity || 1}</td>
      <td style="text-align:right;">${item.rate || ''}</td>
      <td style="text-align:right;font-weight:600;">${item.amount || ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(accentColor)}
    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
    .inv-title { font-size: 28pt; font-weight: 800; color: ${accentColor}; }
    .inv-meta { text-align: right; }
    .inv-meta-item { font-size: 10pt; color: #6b7280; margin-bottom: 3px; }
    .inv-meta-value { font-weight: 600; color: #1a1a2e; }
    .parties { display: flex; gap: 60px; margin-bottom: 30px; }
    .party h4 { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
    .party p { font-size: 10pt; margin-bottom: 2px; }
    .totals { margin-top: 16px; text-align: right; }
    .total-row { display: flex; justify-content: flex-end; gap: 30px; padding: 6px 12px; font-size: 10pt; }
    .total-row.grand { font-size: 14pt; font-weight: 800; color: ${accentColor}; border-top: 2px solid ${accentColor}; padding-top: 10px; margin-top: 6px; }
    .notes { margin-top: 30px; padding: 14px; background: #f8fafc; border-radius: 6px; font-size: 10pt; color: #6b7280; }
  </style></head><body>
    <div class="inv-header">
      <div class="inv-title">${type}</div>
      <div class="inv-meta">
        <div class="inv-meta-item">${type} # <span class="inv-meta-value">${number}</span></div>
        <div class="inv-meta-item">Date: <span class="inv-meta-value">${date}</span></div>
        ${due_date ? `<div class="inv-meta-item">Due: <span class="inv-meta-value">${due_date}</span></div>` : ''}
      </div>
    </div>
    <div class="parties">
      <div class="party"><h4>From</h4><p><strong>${from.name || ''}</strong></p><p>${from.address || ''}</p><p>${from.email || ''}</p><p>${from.phone || ''}</p></div>
      <div class="party"><h4>Bill To</h4><p><strong>${to.name || ''}</strong></p><p>${to.address || ''}</p><p>${to.email || ''}</p><p>${to.phone || ''}</p></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      ${subtotal ? `<div class="total-row"><span>Subtotal</span><span>${subtotal}</span></div>` : ''}
      ${tax ? `<div class="total-row"><span>Tax</span><span>${tax}</span></div>` : ''}
      ${total ? `<div class="total-row grand"><span>Total</span><span>${total}</span></div>` : ''}
    </div>
    ${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ''}
    <div style="margin-top:40px;"><p class="muted">Generated by SoulPrint Engine</p></div>
  </body></html>`;
}

// ─── Template: Conversation Export ───────────────────────────────────────────

function renderConversation(data) {
  const {
    title = 'Conversation Export',
    date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    messages = [],
    participant = 'User',
    accentColor = '#6366f1',
  } = data;

  const msgsHtml = messages.map(msg => {
    const isUser = msg.role === 'user';
    return `<div class="msg ${isUser ? 'msg-user' : 'msg-ai'}">
      <div class="msg-header"><span class="msg-role">${isUser ? participant : 'SoulPrint AI'}</span><span class="msg-time">${msg.time || ''}</span></div>
      <div class="msg-content">${(msg.content || '').replace(/\n/g, '<br>')}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(accentColor)}
    .doc-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${accentColor}33; }
    .msg { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; }
    .msg-user { background: ${accentColor}08; border-left: 3px solid ${accentColor}; }
    .msg-ai { background: #f9fafb; border-left: 3px solid #d1d5db; }
    .msg-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .msg-role { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${accentColor}; }
    .msg-ai .msg-role { color: #6b7280; }
    .msg-time { font-size: 9pt; color: #9ca3af; }
    .msg-content { font-size: 10pt; line-height: 1.5; color: #374151; }
  </style></head><body>
    <div class="doc-header">
      <h1 style="font-size:18pt;">${title}</h1>
      <p class="muted">${date} • ${messages.length} messages</p>
    </div>
    ${msgsHtml}
    <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;"><p class="muted">Exported from SoulPrint Engine</p></div>
  </body></html>`;
}

// ─── Template Registry ───────────────────────────────────────────────────────

const TEMPLATES = {
  report: renderReport,
  summary: renderSummary,
  resume: renderResume,
  invoice: renderInvoice,
  conversation: renderConversation,
};

export { TEMPLATES, htmlToPdf };
