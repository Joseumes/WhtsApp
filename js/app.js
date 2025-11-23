

let workbookData = null;
let rows = [];
let headers = [];

const fileInput = document.getElementById('file-input');
const columnsArea = document.getElementById('columns-area');
const columnsList = document.getElementById('columns-list');
const templateArea = document.getElementById('template-area');
const templateField = document.getElementById('template');
const previewArea = document.getElementById('preview-area');
const previewList = document.getElementById('preview-list');
const phoneColumnSelect = document.getElementById('phone-column');
const previewAllBtn = document.getElementById('preview-all');
const openAllBtn = document.getElementById('open-all');

fileInput.addEventListener('change', handleFile);
previewAllBtn.addEventListener('click', ()=>renderPreview(5));
openAllBtn.addEventListener('click', openAllInWhatsapp);

function handleFile(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  const name = f.name.toLowerCase();
  if(name.endsWith('.csv')){
    reader.onload = (ev)=>{
      const csv = ev.target.result;
      const data = XLSX.read(csv, {type:'string'});
      parseWorkbook(data);
    };
    reader.readAsText(f, 'utf-8');
  } else {
    reader.onload = (ev)=>{
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, {type:'array'});
      parseWorkbook(wb);
    };
    reader.readAsArrayBuffer(f);
  }
}

function parseWorkbook(wb){
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(firstSheet, {defval:''});
  rows = json;
  headers = Object.keys(rows[0] || {});
  renderColumns();
  columnsArea.classList.remove('hidden');
  templateArea.classList.remove('hidden');
  previewArea.classList.remove('hidden');
}

function renderColumns(){
  columnsList.innerHTML = '';
  phoneColumnSelect.innerHTML = '';
  headers.forEach(h=>{
    const pill = document.createElement('div');
    pill.className = 'col-pill';
    pill.textContent = h;
    columnsList.appendChild(pill);

    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    phoneColumnSelect.appendChild(opt);
  });
}

function interpolate(template, row){
  return template.replace(/{{\s*([^}]+)\s*}}/g, (m,key)=>{
    // if exact header match
    if(row.hasOwnProperty(key)) return row[key];
    // try case-insensitive match
    const found = Object.keys(row).find(k=>k.toLowerCase()===key.toLowerCase());
    if(found) return row[found];
    return '';
  });
}

function formatPhone(raw){
  if(typeof raw !== 'string' && typeof raw !== 'number') return '';
  let s = String(raw).trim();
  // remove spaces, dashes, parentheses
  s = s.replace(/[\s\-()]/g,'');
  // remove leading + if present (wa.me expects no plus)
  s = s.replace(/^\+/, '');
  return s;
}

function renderPreview(limit=5){
  previewList.innerHTML = '';
  const tmpl = templateField.value;
  for(let i=0;i<Math.min(limit, rows.length); i++){
    const r = rows[i];
    const text = interpolate(tmpl, r);
    const phoneCol = phoneColumnSelect.value || headers.find(h=>/phone|tel|movil|cel/i.test(h)) || '';
    const phone = formatPhone(r[phoneCol] || r['Telefono'] || r['telefono'] || r['telefono_movil'] || '');

    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `
      <div class="preview-top"><strong>#${i+1}</strong><div class="preview-actions"><button class="small-btn" data-index="${i}">Abrir en WhatsApp</button></div></div>
      <div class="preview-text">${escapeHtml(text)}</div>
      <div class="meta">Telefono: ${phone || '<em>no detectado</em>'}</div>
    `;
    previewList.appendChild(div);
  }
  // attach click handlers
  document.querySelectorAll('.small-btn').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const idx = Number(ev.target.getAttribute('data-index'));
      openOneInWhatsapp(idx);
    });
  });
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openOneInWhatsapp(index){
  const tmpl = templateField.value;
  const row = rows[index];
  const text = interpolate(tmpl, row);
  const phoneCol = phoneColumnSelect.value || headers.find(h=>/phone|tel|movil|cel/i.test(h)) || '';
  const phone = formatPhone(row[phoneCol]);
  if(!phone){
    alert('No se detectó número en la fila ' + (index+1) + '. Elige la columna correcta en "Columna de teléfono".');
    return;
  }
  const encoded = encodeURIComponent(text);
  const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

  window.open(url, '_blank');
}

function openAllInWhatsapp(){
  // abre cada fila en una pestaña nueva (cuidado con muchas filas)
  const tmpl = templateField.value;
  const phoneCol = phoneColumnSelect.value || headers.find(h=>/phone|tel|movil|cel/i.test(h)) || '';
  let count=0;
  for(let i=0;i<rows.length;i++){
    const row = rows[i];
    const phone = formatPhone(row[phoneCol]);
    if(!phone) continue;
    const text = interpolate(tmpl, row);
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
    count++;
    // small delay could be added but we leave it to the browser
  }
  if(count===0) alert('No se encontró ningún teléfono en las filas. Selecciona la columna correcta.');
}

// helper: prefill a sample template
(function(){
  templateField.value = 'Hola {{Nombre}}, te saluda José. Vi que te interesa {{Carrera}}. ¿Te interesa más información?';
})();
