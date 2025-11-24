// ===============================
// CONFIGURAR SUPABASE
// ===============================
const SUPABASE_URL = "https://eefnhmluhsyejoszrjir.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZm5obWx1aHN5ZWpvc3pyamlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Mjg2ODIsImV4cCI6MjA3OTUwNDY4Mn0.UNatlYPt6EoNMy6fWPBxNilYvoJx5mbDwviCF9Gpdw0";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(() => {
  // ... (todos tus elementos DOM — sin cambios)
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
  const progressArea = document.getElementById('progress-area');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');
  const searchInput = document.getElementById('search-input');
  const perPageSelect = document.getElementById('per-page');
  const pager = document.getElementById('pager');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pagerInfo = document.getElementById('pager-info');

  const saveProgressBtn = document.getElementById('saveProgress');
  const exportExcelBtn = document.getElementById('exportExcel');
  const resetAllBtn = document.getElementById('resetAll');

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
  let rows = [];
  let headers = [];
  const statusKey = '_WMSG_STATUS_';
  let currentIndex = -1;
  let CURRENT_UMES_ID = null;
  let currentFilename = null;

  // Pagination
  let currentPage = 1;
  function perPage() { return Number(perPageSelect.value || 20); }

  // --- Helpers ---
  function setFileInfo(txt) { if (fileInfo) fileInfo.textContent = txt; }
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

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
      const foundKey = Object.keys(row).find(k => String(k).trim().toLowerCase() === key.trim().toLowerCase());
      if (foundKey) {
        const v = row[foundKey];
        return v === null || v === undefined ? '' : String(v);
      }
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
    if (progressText) progressText.textContent = `Total: ${total} | Enviado: ${sent} | No enviado: ${notsent} | Pendiente: ${pending}`;
    if (progressFill) {
      const pct = total ? Math.round(((sent + notsent) / total) * 100) : 0;
      progressFill.style.width = pct + '%';
    }
    if (total > 0 && progressArea) show(progressArea); else if (progressArea) hide(progressArea);
  }

  // --- Guardar estado individual en Supabase (automático) ---
  async function autoSaveProgress() {
    if (!CURRENT_UMES_ID) return;
    try {
      await supabase
        .from("umes")
        .update({ progreso: rows.map(r => ({ estado: r[statusKey] })) })
        .eq("id", CURRENT_UMES_ID);
    } catch (err) {
      console.warn("No se pudo guardar automáticamente:", err);
    }
  }

  // --- Cargar último progreso NO finalizado ---
  async function loadLatestActiveProgress() {
    setFileInfo("Buscando sesión activa en la nube...");

    const { data, error } = await supabase
      .from("umes")
      .select("*")
      .eq("finalizado", false) // 🔑 Solo los no finalizados
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error al cargar:", error);
      setFileInfo("Ningún archivo cargado");
      return false;
    }

    if (data && data.length > 0) {
      const record = data[0];
      rows = record.filas || [];
      currentFilename = record.nombre_archivo;
      CURRENT_UMES_ID = record.id;

      if (record.progreso && Array.isArray(record.progreso)) {
        rows = rows.map((row, i) => ({
          ...row,
          [statusKey]: record.progreso[i]?.estado || "Pendiente"
        }));
      } else {
        rows = rows.map(row => ({ ...row, [statusKey]: "Pendiente" }));
      }

      headers = rows.length ? Object.keys(rows[0]).filter(k => k !== statusKey) : [];
      renderColumns();
      show(templateArea);
      show(previewArea);
      if (record.plantilla) templateField.value = record.plantilla;
      setFileInfo(`${currentFilename} — ${rows.length} contactos (activo)`);
      updateProgressUI();
      renderPreviewList(1);

      // Escuchar cambios en tiempo real
      supabase
        .channel(`realtime-umes-${CURRENT_UMES_ID}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "umes", filter: `id=eq.${CURRENT_UMES_ID}` },
          (payload) => {
            const { filas, progreso, plantilla } = payload.new;
            if (payload.new.finalizado) return; // Si se finalizó, ignorar
            rows = filas.map((r, i) => ({
              ...r,
              [statusKey]: progreso[i]?.estado || "Pendiente"
            }));
            if (plantilla) templateField.value = plantilla;
            updateProgressUI();
            renderPreviewList(currentPage);
          }
        )
        .subscribe();

      return true;
    } else {
      setFileInfo("Ningún archivo cargado");
      return false;
    }
  }

  // --- Render columns ---
  function renderColumns() {
    if (!columnsList || !phoneColSelect) return;
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
    reader.onload = (e) => {
      try {
        let wb;
        if (name.endsWith('.csv')) {
          wb = XLSX.read(e.target.result, { type: 'string' });
        } else {
          const data = new Uint8Array(e.target.result);
          wb = XLSX.read(data, { type: 'array' });
        }
        parseWorkbook(wb, f.name);
      } catch (err) {
        alert('Error al leer archivo: ' + err.message);
      }
    };
    if (name.endsWith('.csv')) reader.readAsText(f, 'utf-8'); else reader.readAsArrayBuffer(f);
  });

  function parseWorkbook(wb, filename) {
    const first = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(first, { defval: '' });
    rows = json.map(r => {
      const clone = { ...r };
      if (!clone.hasOwnProperty(statusKey)) clone[statusKey] = 'Pendiente';
      return clone;
    });
    headers = rows.length ? Object.keys(rows[0]) : [];
    currentFilename = filename;
    renderColumns();
    show(templateArea);
    show(previewArea);
    currentPage = 1;
    updateProgressUI();
    renderPreviewList(currentPage);
  }

  // --- Preview rendering (igual que antes) ---
  function getFilteredRows() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }

  function renderPreviewList(page = 1) {
    if (!previewList) return;
    previewList.innerHTML = '';
    const tmpl = templateField.value || '';
    const filtered = getFilteredRows();
    const total = filtered.length;
    const p = Math.max(1, Math.min(page, Math.ceil(total / perPage()) || 1));
    currentPage = p;
    const per = perPage();
    const start = (currentPage - 1) * per;
    const end = Math.min(start + per, total);

    for (let idx = start; idx < end; idx++) {
      const r = filtered[idx];
      const text = interpolate(tmpl, r);
      const phone = formatPhone(r[phoneColSelect.value]);

      const item = document.createElement('div');
      item.className = 'preview-item';

      const left = document.createElement('div');
      left.className = 'preview-left';
      left.innerHTML = `<div class="preview-meta"><strong>#${idx + 1}</strong> | Tel: ${phone || '<em>sin teléfono</em>'}</div>
                        <div class="preview-text">${escapeHtml(text)}</div>
                        <div class="preview-meta">Estado: <strong>${r[statusKey]}</strong></div>`;

      const actions = document.createElement('div');
      actions.className = 'preview-actions';

      const sendBtn = document.createElement('button');
      sendBtn.className = 'small-btn btn-send';
      sendBtn.textContent = 'Enviar WhatsApp';
      sendBtn.addEventListener('click', () => {
        if (!phone) { alert('No se encontró teléfono.'); return; }
        const encoded = encodeURIComponent(text);
        const url = modeSelect.value === 'web'
          ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`
          : `whatsapp://send?phone=${phone}&text=${encoded}`;
        window.open(url, '_blank');
      });

      const cbWrap = document.createElement('label');
      cbWrap.className = 'checkbox-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = r[statusKey] === 'Enviado';
      cb.addEventListener('change', () => {
        r[statusKey] = cb.checked ? 'Enviado' : 'Pendiente';
        updateProgressUI();
        autoSaveProgress(); // ✅ Guardado automático al marcar
        const metaLines = left.querySelectorAll('.preview-meta');
        if (metaLines[2]) metaLines[2].innerHTML = `Estado: <strong>${r[statusKey]}</strong>`;
      });

      const notSentBtn = document.createElement('button');
      notSentBtn.className = 'small-btn';
      notSentBtn.style.background = 'transparent';
      notSentBtn.style.border = '1px solid rgba(0,0,0,0.04)';
      notSentBtn.textContent = 'No enviado';
      notSentBtn.addEventListener('click', () => {
        r[statusKey] = 'No enviado';
        cb.checked = false;
        updateProgressUI();
        autoSaveProgress(); // ✅ Guardado automático
        const metaLines = left.querySelectorAll('.preview-meta');
        if (metaLines[2]) metaLines[2].innerHTML = `Estado: <strong>${r[statusKey]}</strong>`;
      });

      const detailBtn = document.createElement('button');
      detailBtn.className = 'small-btn';
      detailBtn.textContent = 'Abrir detalle';
      detailBtn.addEventListener('click', () => {
        currentIndex = rows.indexOf(r);
        openModalForIndex(currentIndex);
      });

      actions.appendChild(sendBtn);
      cbWrap.appendChild(cb);
      cbWrap.appendChild(document.createTextNode(' Enviado'));
      actions.appendChild(cbWrap);
      actions.appendChild(notSentBtn);
      actions.appendChild(detailBtn);

      item.appendChild(left);
      item.appendChild(actions);
      previewList.appendChild(item);
    }

    if (total > per) {
      show(pager);
      pagerInfo.textContent = `Mostrando ${start + 1}-${end} de ${total} (pág ${currentPage} / ${Math.ceil(total / per)})`;
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= Math.ceil(total / per);
    } else {
      hide(pager);
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // --- Resto de funciones (modal, open all, etc.) sin cambios ---
  if (previewBtn) previewBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    renderPreviewList(1);
  });
  if (searchInput) searchInput.addEventListener('input', () => renderPreviewList(1));
  if (perPageSelect) perPageSelect.addEventListener('change', () => renderPreviewList(1));
  if (prevPageBtn) prevPageBtn.addEventListener('click', () => renderPreviewList(currentPage - 1));
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => renderPreviewList(currentPage + 1));

  // Modal functions (same as before)
  if (startBtn) startBtn.addEventListener('click', () => {
    const idx = rows.findIndex(r => r[statusKey] === 'Pendiente');
    if (idx === -1) { alert('No hay contactos pendientes.'); return; }
    currentIndex = idx;
    openModalForIndex(currentIndex);
  });

  function openModalForIndex(idx) {
    if (idx < 0 || idx >= rows.length) return;
    const r = rows[idx];
    if (r[statusKey] !== 'Pendiente') {
      const next = rows.findIndex((x, i) => i > idx && x[statusKey] === 'Pendiente');
      if (next === -1) { alert('No hay más pendientes.'); return; }
      currentIndex = next;
      return openModalForIndex(next);
    }
    modalTitle.textContent = `Contacto #${idx + 1}`;
    modalMeta.textContent = `Fila ${idx + 1} | Estado: ${r[statusKey]}`;
    modalMessage.value = interpolate(templateField.value, r);
    const phone = formatPhone(r[phoneColSelect.value]);
    modalPhone.textContent = phone ? `Teléfono: ${phone}` : 'Teléfono: (no detectado)';
    show(modal);
    modal.setAttribute('aria-hidden', 'false');
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => { hide(modal); modal.setAttribute('aria-hidden', 'true'); });

  if (modalOpenBtn) modalOpenBtn.addEventListener('click', () => {
    if (currentIndex === -1) return;
    const r = rows[currentIndex];
    const phone = formatPhone(r[phoneColSelect.value]);
    if (!phone) { alert('No se detectó teléfono.'); return; }
    const text = modalMessage.value;
    const encoded = encodeURIComponent(text);
    const url = modeSelect.value === 'web'
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`
      : `whatsapp://send?phone=${phone}&text=${encoded}`;
    window.open(url, '_blank');
  });

  function updateStatusAndGoNext(status) {
    if (currentIndex === -1) return;
    rows[currentIndex][statusKey] = status;
    updateProgressUI();
    autoSaveProgress();
    hide(modal);
    modal.setAttribute('aria-hidden', 'true');
    renderPreviewList(currentPage);
    goToNextAfter(currentIndex);
  }

  if (modalSentBtn) modalSentBtn.addEventListener('click', () => updateStatusAndGoNext('Enviado'));
  if (modalNotSentBtn) modalNotSentBtn.addEventListener('click', () => updateStatusAndGoNext('No enviado'));
  if (modalNextBtn) modalNextBtn.addEventListener('click', () => {
    hide(modal);
    goToNextAfter(currentIndex);
  });
  if (modalCopyBtn) modalCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalMessage.value).catch(() => alert('No se pudo copiar.'));
  });

  function goToNextAfter(idx) {
    const next = rows.findIndex((r, i) => i > idx && r[statusKey] === 'Pendiente');
    if (next !== -1) {
      currentIndex = next;
      setTimeout(() => openModalForIndex(currentIndex), 200);
    } else {
      const rem = rows.findIndex(r => r[statusKey] === 'Pendiente');
      if (rem !== -1) {
        currentIndex = rem;
        setTimeout(() => openModalForIndex(currentIndex), 200);
      } else {
        alert('Proceso finalizado.');
        currentIndex = -1;
      }
    }
  }

  if (openAllBtn) openAllBtn.addEventListener('click', () => {
    if (!rows.length) { alert('Carga primero un archivo.'); return; }
    if (!confirm('¿Abrir todos los contactos con teléfono?')) return;
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
    if (count === 0) alert('No se detectaron teléfonos.');
  });

  // --- ✅ EXPORTAR Y MARCAR COMO FINALIZADO ---
  if (exportExcelBtn) exportExcelBtn.addEventListener('click', async () => {
    if (!rows.length) { alert('No hay datos.'); return; }

    // Guardar estado final
    await autoSaveProgress();

    // Marcar como finalizado en Supabase
    if (CURRENT_UMES_ID) {
      await supabase
        .from("umes")
        .update({ finalizado: true }) // 🔑 ¡Aquí está la bandera!
        .eq("id", CURRENT_UMES_ID);
    }

    // Exportar
    const exportData = rows.map(r => {
      const row = { ...r };
      delete row[statusKey];
      row.completado = r[statusKey] === 'Enviado' ? 'Sí' :
                       r[statusKey] === 'No enviado' ? 'No' : 'Pendiente';
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `completado-${currentFilename || "datos"}.xlsx`);

    alert("✅ Exportación completada y marcada como finalizada.");
    // Reiniciar interfaz
    rows = [];
    headers = [];
    CURRENT_UMES_ID = null;
    currentFilename = null;
    fileInput.value = "";
    setFileInfo("Ningún archivo cargado");
    hide(columnsArea);
    hide(templateArea);
    hide(previewArea);
    hide(progressArea);
    templateField.value = "Hola {{Nombre}}, soy José. ¿Te interesa {{Carrera}}?";
    updateProgressUI();
  });

  // --- Guardar progreso manual (crea nuevo registro) ---
  if (saveProgressBtn) saveProgressBtn.addEventListener('click', async () => {
    if (!rows.length || !templateField.value.trim()) {
      alert("Carga un archivo y escribe una plantilla primero.");
      return;
    }

    const { data, error } = await supabase
      .from("umes")
      .insert([
        {
          nombre_archivo: currentFilename,
          filas: rows,
          progreso: rows.map(r => ({ estado: r[statusKey] })),
          plantilla: templateField.value,
          finalizado: false // 🔑 Siempre false al guardar
        }
      ])
      .select("id")
      .single();

    if (error) {
      console.error("Error:", error);
      alert("❌ Error al guardar: " + (error.message || "Ver consola"));
    } else {
      CURRENT_UMES_ID = data.id;
      alert("✅ Guardado como sesión activa");
      // Escuchar cambios
      supabase
        .channel(`realtime-umes-${CURRENT_UMES_ID}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "umes", filter: `id=eq.${CURRENT_UMES_ID}` }, (payload) => {
          if (payload.new.finalizado) return;
          const { filas, progreso, plantilla } = payload.new;
          rows = filas.map((r, i) => ({ ...r, [statusKey]: progreso[i]?.estado || "Pendiente" }));
          if (plantilla) templateField.value = plantilla;
          updateProgressUI();
          renderPreviewList(currentPage);
        })
        .subscribe();
    }
  });

  if (resetAllBtn) resetAllBtn.addEventListener('click', () => {
    if (confirm("¿Reiniciar todo?")) location.reload();
  });

  // --- ✅ INICIALIZAR: Cargar solo si hay sesión activa ---
  (async function init() {
    templateField.value = templateField.value || "Hola {{Nombre}}, soy José. ¿Te interesa {{Carrera}}?";
    updateProgressUI();
    await loadLatestActiveProgress(); // 🔑 Solo carga si finalizado = false
  })();
})();