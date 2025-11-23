/* js/app.js
   WMessage Web - cliente puro (no servidor)
   Necesita: xlsx (SheetJS) cargado en index.html
*/

(() => {
  // DOM
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const columnsArea = document.getElementById('columns-area');
  const columnsList = document.getElementById('columns-list');
  const phoneColSelect = document.getElementById('phone-col');
  const modeSelect = document.getElementById('mode-select');
  const templateArea = document.getElementById('template-area');
  const templateField = document.getElementById('template');
  const previewBtn = document.getElementById('preview-btn');
  const startBtn = document.getElementById('start-btn');
  const openAllBtn = document.getElementById('open-all-btn');
  const previewArea = document.getElementById('preview-area');
  const previewList = document.getElementById('preview-list');
  const exportBtn = document.getElementById('export-btn');
  const progressArea = document.getElementById('progress-area');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');

  // Modal elements
  const modal = document.getElementById('modal');
  const closeModalBtn = document.getElementById('close-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalMessage = document.getElementById('modal-message');
  const modalPhone = document.getElementById('modal-phone');
  const modalOpenBtn = document.getElementById('modal-open');
  const modalSentBtn = document.getElementById('modal-sent');
  const modalNotSentBtn = document.getElementById('modal-not-sent');
  const modalNextBtn = document.getElementById('modal-next');
  const modalCopyBtn = document.getElementById('modal-copy');

  // Data
  let rows = []; // array of objects
  let headers = [];
  let statusKey = '_WMSG_STATUS_'; // status key injected to rows
  let currentIndex = -1;

  // --- Helpers ---
  function setFileInfo(txt) { fileInfo.textContent = txt; }
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function formatPhone(raw) {
    if (raw === undefined || raw === null) return '';
    let s = String(raw).trim();
    s = s.replace(/[\s\-\(\)\.]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('00')) s = s.slice(2);
    return s;
  }

  function interpolate(template, row) {
    if (!template) return '';
    return template.replace(/{{\s*([^}]+)\s*}}/g, (m, key) => {
      // exact match case-insensitive
      const foundKey = Object.keys(row).find(k => String(k).trim().toLowerCase() === key.trim().toLowerCase());
      if (foundKey) {
        const v = row[foundKey];
        return v === null || v === undefined ? '' : String(v);
      }
      // partial match (column contains key)
      const part = Object.keys(row).find(k => String(k).toLowerCase().includes(key.trim().toLowerCase()));
      if (part) {
        const v = row[part];
        return v === null || v === undefined ? '' : String(v);
      }
      return '';
    });
  }

  function updateProgressUI() {
    const total = rows.length;
    const sent = rows.filter(r => r[statusKey] === 'Enviado').length;
    const notsent = rows.filter(r => r[statusKey] === 'No enviado').length;
    const pending = rows.filter(r => r[statusKey] === 'Pendiente').length;
    progressText.textContent = `Total: ${total} | Enviado: ${sent} | No enviado: ${notsent} | Pendiente: ${pending}`;
    if (total === 0) {
      progressFill.style.width = '0%';
    } else {
      const pct = Math.round(((sent + notsent) / total) * 100);
      progressFill.style.width = pct + '%';
    }
    if (total > 0) show(progressArea); else hide(progressArea);
  }

  function readWorkbookFromCSV(text) {
    // Use SheetJS to parse CSV as workbook
    return XLSX.read(text, { type: 'string' });
  }

  function parseWorkbook(wb) {
    const first = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(first, { defval: '' });
    rows = json.map(r => {
      // ensure status key exists
      const clone = Object.assign({}, r);
      if (!clone.hasOwnProperty(statusKey)) clone[statusKey] = 'Pendiente';
      return clone;
    });
    headers = Object.keys(rows[0] || {});
    renderColumns();
    show(templateArea);
    show(previewArea);
    updateProgressUI();
  }

  // --- Render columns and phone selector ---
  function renderColumns() {
    columnsList.innerHTML = '';
    phoneColSelect.innerHTML = '';
    headers.forEach(h => {
      const pill = document.createElement('div');
      pill.className = 'pill';
      pill.textContent = h;
      columnsList.appendChild(pill);

      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      phoneColSelect.appendChild(opt);
    });

    // guess phone column
    const guess = headers.find(h => /phone|telefono|tel|cel|movil|whatsapp/i.test(h));
    if (guess) phoneColSelect.value = guess;
    else if (headers.length) phoneColSelect.value = headers[0];

    show(columnsArea);
  }

  // --- File input handler ---
  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    setFileInfo(f.name);
    const name = f.name.toLowerCase();
    const reader = new FileReader();
    if (name.endsWith('.csv')) {
      reader.onload = (e) => {
        try {
          const wb = readWorkbookFromCSV(e.target.result);
          parseWorkbook(wb);
        } catch (err) {
          alert('Error al leer CSV: ' + err.message);
        }
      };
      reader.readAsText(f, 'utf-8');
    } else {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          parseWorkbook(wb);
        } catch (err) {
          alert('Error al leer Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(f);
    }
  });

  // --- Preview ---
  previewBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    previewList.innerHTML = '';
    const tmpl = templateField.value;
    const limit = Math.min(5, rows.length);
    for (let i = 0; i < limit; i++) {
      const r = rows[i];
      const txt = interpolate(tmpl, r);
      const phoneCol = phoneColSelect.value;
      const phone = formatPhone(r[phoneCol]);
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<div class="preview-meta"><strong>#${i+1}</strong> | Tel: ${phone || '<em>sin teléfono</em>'}</div>
                       <div>${escapeHtml(txt)}</div>
                       <div class="preview-meta">Estado: ${r[statusKey]}</div>`;
      previewList.appendChild(div);
    }
    show(previewArea);
  });

  // escape for display only
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // --- One-by-one sequence ---
  startBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    // find first pending
    const idx = rows.findIndex(r => r[statusKey] === 'Pendiente');
    if (idx === -1) { alert('No hay contactos pendientes.'); return; }
    currentIndex = idx;
    openModalForIndex(currentIndex);
  });

  function openModalForIndex(idx) {
    if (idx < 0 || idx >= rows.length) { return; }
    const r = rows[idx];
    // skip non-pending by moving to next pending
    if (r[statusKey] !== 'Pendiente') {
      const next = rows.findIndex((x, i) => i > idx && x[statusKey] === 'Pendiente');
      if (next === -1) { alert('No hay más pendientes.'); return; }
      currentIndex = next;
      return openModalForIndex(next);
    }
    modalTitle.textContent = `Contacto #${idx + 1}`;
    modalMeta.textContent = `Fila ${idx + 1} | Estado: ${r[statusKey]}`;
    const msg = interpolate(templateField.value, r);
    modalMessage.value = msg;
    const phone = formatPhone(r[phoneColSelect.value]);
    modalPhone.textContent = phone ? `Teléfono: ${phone}` : 'Teléfono: (no detectado)';
    show(modal);
    modal.setAttribute('aria-hidden', 'false');
  }

  // modal controls
  closeModalBtn.addEventListener('click', () => {
    hide(modal);
    modal.setAttribute('aria-hidden', 'true');
  });

  modalOpenBtn.addEventListener('click', () => {
    if (currentIndex === -1) return;
    const r = rows[currentIndex];
    const phone = formatPhone(r[phoneColSelect.value]);
    if (!phone) { alert('No se detectó teléfono. Elige la columna correcta.'); return; }
    const text = modalMessage.value;
    const encoded = encodeURIComponent(text);
    const mode = modeSelect.value;
    let url = '';
    if (mode === 'web') {
      url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    } else {
      // whatsapp uri
      url = `whatsapp://send?phone=${phone}&text=${encoded}`;
    }
    // open in new tab/window
    window.open(url, '_blank');
  });

  modalSentBtn.addEventListener('click', () => {
    if (currentIndex === -1) return;
    rows[currentIndex][statusKey] = 'Enviado';
    updateProgressUI();
    hide(modal);
    modal.setAttribute('aria-hidden', 'true');
    goToNextAfter(currentIndex);
  });

  modalNotSentBtn.addEventListener('click', () => {
    if (currentIndex === -1) return;
    rows[currentIndex][statusKey] = 'No enviado';
    updateProgressUI();
    hide(modal);
    modal.setAttribute('aria-hidden', 'true');
    goToNextAfter(currentIndex);
  });

  modalNextBtn.addEventListener('click', () => {
    // keep pending and move next
    hide(modal);
    modal.setAttribute('aria-hidden', 'true');
    goToNextAfter(currentIndex);
  });

  modalCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalMessage.value).then(() => {
      alert('Mensaje copiado al portapapeles.');
    }).catch(() => alert('No se pudo copiar al portapapeles.'));
  });

  function goToNextAfter(idx) {
    // find next pending after idx
    const next = rows.findIndex((r, i) => i > idx && r[statusKey] === 'Pendiente');
    if (next !== -1) {
      currentIndex = next;
      setTimeout(() => openModalForIndex(currentIndex), 200); // pequeño delay para UX
    } else {
      // any pending anywhere?
      const rem = rows.findIndex(r => r[statusKey] === 'Pendiente');
      if (rem !== -1) {
        currentIndex = rem;
        setTimeout(() => openModalForIndex(currentIndex), 200);
      } else {
        alert('Proceso finalizado: no hay más pendientes.');
        currentIndex = -1;
      }
    }
  }

  // --- Open all (warning about many tabs) ---
  openAllBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    if (!confirm('Se abrirán pestañas para cada contacto con teléfono detectado. ¿Deseas continuar?')) return;
    const mode = modeSelect.value;
    const tmpl = templateField.value;
    let count = 0;
    rows.forEach(r => {
      const phone = formatPhone(r[phoneColSelect.value]);
      if (!phone) return;
      const text = interpolate(tmpl, r);
      const encoded = encodeURIComponent(text);
      const url = mode === 'web'
        ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`
        : `whatsapp://send?phone=${phone}&text=${encoded}`;
      window.open(url, '_blank');
      count++;
    });
    if (count === 0) alert('No se detectaron teléfonos. Selecciona la columna correcta.');
  });

  // --- Export CSV (with status) ---
  exportBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    // build CSV from rows (including statusKey)
    const hdrs = Object.keys(rows[0]);
    // ensure status column present
    if (!hdrs.includes(statusKey)) hdrs.push(statusKey);
    const lines = [];
    lines.push(hdrs.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
    rows.forEach(r => {
      const vals = hdrs.map(h => {
        const v = r.hasOwnProperty(h) ? (r[h] === null || r[h] === undefined ? '' : String(r[h])) : '';
        return `"${v.replace(/"/g, '""')}"`;
      });
      lines.push(vals.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = 'wmessage_export.csv';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // init
  (function init() {
    // sample template
    templateField.value = "Hola {{Nombre}}, soy José. Vi que te interesa {{Carrera}}. ¿Quieres más info?";
    updateProgressUI();
  })();

})();
