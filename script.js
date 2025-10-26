// script.js - SkyFly Pro logic (diperbarui, termasuk seat selection & passenger inputs)

// --- Helper / state ---
function q(selector) { return document.querySelector(selector); }
function qAll(selector) { return document.querySelectorAll(selector); }

const state = {
  currentOrderId: null,
  passengers: [], // {name, seat}
  selectedPassengerIndex: null,
  seatLayout: null // populated when rendering seatmap
};

/* -------- Navigation (SPA) -------- */
function showPage(pageId) {
  qAll('.page').forEach(p => p.classList.remove('active'));
  const page = q(`#${pageId}`);
  if (page) page.classList.add('active');

  // special actions
  if (pageId === 'riwayatPage') renderRiwayat();
  if (pageId === 'pesanPage') {
    updatePreview();
    generatePassengerInputs(); // ensure inputs reflect jumlah
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initial
document.addEventListener('DOMContentLoaded', () => {
  // attach events
  attachFormHandlers();
  attachThemeToggle();
  updateHarga();
  showPage('homePage');
});

/* -------- Theme toggle -------- */
function attachThemeToggle() {
  const themeToggle = q('#themeToggle');
  const saved = localStorage.getItem('skyfly_theme');
  if (saved === 'dark') document.body.classList.add('dark'), themeToggle.textContent = 'Light';
  else themeToggle.textContent = 'Dark';

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    if (document.body.classList.contains('dark')) {
      localStorage.setItem('skyfly_theme', 'dark');
      themeToggle.textContent = 'Light';
    } else {
      localStorage.setItem('skyfly_theme', 'light');
      themeToggle.textContent = 'Dark';
    }
  });
}

/* -------- Form handling & price calc -------- */
function attachFormHandlers() {
  // form elements
  const form = q('#formPemesanan');
  const inputs = ['#nama','#asal','#tujuan','#tanggal','#jumlah','#maskapai','#kelas'];
  inputs.forEach(sel => {
    const el = q(sel);
    if (el) el.addEventListener('input', updatePreview);
    if (el) el.addEventListener('change', () => { updateHarga(); generatePassengerInputs(); });
  });

  // submit
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    saveOrderFromForm();
  });

  // payment modal buttons
  q('#payNowBtn')?.addEventListener('click', openPaymentModal);
  q('#confirmPaymentBtn')?.addEventListener('click', confirmPayment);
  q('#paymentModal')?.addEventListener('click', (ev) => {
    if (ev.target === q('#paymentModal')) closePaymentModal();
  });

  // payment method selection UI
  qAll('.pay-method').forEach(btn => {
    btn.addEventListener('click', () => {
      qAll('.pay-method').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      q('#confirmPaymentBtn').dataset.method = btn.dataset.method;
    });
  });

  // pdf & print
  q('#downloadPdfBtn')?.addEventListener('click', downloadTicketPdf);
  q('#printBtn')?.addEventListener('click', printTicket);

  // seat modal handlers
  q('#seatModal')?.addEventListener('click', (ev) => {
    if (ev.target === q('#seatModal')) closeSeatModal();
  });

  // seat select & clear
  q('#seatSelectBtn')?.addEventListener('click', openSeatModal);
  q('#clearSeatsBtn')?.addEventListener('click', clearSeatAssignments);
}

/* Calculate price */
function updateHarga() {
  const maskapaiEl = q('#maskapai');
  const kelasEl = q('#kelas');
  const jumlah = parseInt(q('#jumlah').value) || 1;

  const base = parseInt(maskapaiEl.options[maskapaiEl.selectedIndex].dataset.harga) || 0;
  const multiplier = parseFloat(kelasEl.options[kelasEl.selectedIndex].dataset.multiplier) || 1;

  const total = Math.round(base * multiplier * jumlah);
  q('#totalHarga').textContent = formatRupiah(total);
  // also update preview
  updatePreview();
}

function formatRupiah(number) {
  return 'Rp' + Number(number).toLocaleString('id-ID');
}

/* ===== Passenger inputs generation ===== */
function generatePassengerInputs() {
  const container = q('#passengerInputsContainer');
  const jumlah = Math.max(1, parseInt(q('#jumlah').value) || 1);
  // ensure state.passengers length matches jumlah
  if (!Array.isArray(state.passengers)) state.passengers = [];
  if (state.passengers.length > jumlah) state.passengers = state.passengers.slice(0, jumlah);
  while (state.passengers.length < jumlah) state.passengers.push({ name: '', seat: null });

  container.innerHTML = '';
  for (let i = 0; i < jumlah; i++) {
    const idx = i;
    const wrapper = document.createElement('div');
    wrapper.className = 'grid md:grid-cols-2 gap-4 items-center';
    wrapper.innerHTML = `
      <div>
        <label class="text-sm font-medium">Nama Penumpang ${i+1}</label>
        <input type="text" data-pass-index="${i}" class="input-field mt-1 passenger-name" placeholder="Nama lengkap" value="${state.passengers[i].name || ''}">
      </div>
      <div>
        <label class="text-sm font-medium">Kursi</label>
        <div class="mt-1 flex gap-2 items-center">
          <div class="input-field py-2 px-3 bg-white dark:bg-gray-900 min-w-0 flex-1" id="seatLabel_${i}">${state.passengers[i].seat || '—'}</div>
          <button type="button" class="btn-outline-lg" onclick="openSeatModal(${i})">Pilih</button>
        </div>
      </div>
    `;
    container.appendChild(wrapper);
  }

  // attach input listeners
  qAll('.passenger-name').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.passIndex);
      state.passengers[idx].name = e.target.value;
      updatePreview();
    });
  });

  updatePreview();
}

/* Update preview card */
function updatePreview() {
  const name = q('#nama').value || '—';
  const asal = q('#asal').value || '—';
  const tujuan = q('#tujuan').value || '—';
  const tanggal = q('#tanggal').value || '—';
  const jumlah = q('#jumlah').value || '—';
  const maskapai = q('#maskapai').value || '—';
  const kelas = q('#kelas').value || '—';

  const totalText = q('#totalHarga').textContent || 'Rp0';

  q('#previewName').textContent = name;
  q('#previewRoute').textContent = `${asal} → ${tujuan}`;
  q('#previewDate').textContent = `Tanggal: ${tanggal}`;
  q('#previewAirline').textContent = maskapai;
  q('#previewClass').textContent = kelas;
  q('#previewQty').textContent = jumlah;
  q('#previewTotal').textContent = totalText;

  // generate temporary order id
  if (!state.currentOrderId) {
    state.currentOrderId = 'SF' + Date.now().toString().slice(-7);
  }
  q('#orderIdPreview').textContent = state.currentOrderId;

  // passengers list in preview
  const passengerListEl = q('#passengerPreviewList');
  passengerListEl.innerHTML = '';
  if (Array.isArray(state.passengers) && state.passengers.length) {
    const ul = document.createElement('div');
    ul.className = 'space-y-1';
    state.passengers.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'text-sm';
      div.textContent = `${i+1}. ${p.name || '—'} ${p.seat ? '(' + p.seat + ')' : ''}`;
      ul.appendChild(div);
    });
    passengerListEl.appendChild(ul);
  }

  // QR: include compact JSON
  const qrData = {
    id: state.currentOrderId,
    nama: name,
    route: `${asal}->${tujuan}`,
    total: totalText,
    passengers: state.passengers.map(p => ({ name: p.name, seat: p.seat }))
  };
  renderQRCode(JSON.stringify(qrData));
}

/* QR rendering */
let qrInstance = null;
function renderQRCode(text) {
  const container = q('#qrcode');
  container.innerHTML = '';
  try {
    qrInstance = new QRCode(container, {
      text: text,
      width: 90,
      height: 90,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch (e) { /* ignore */ }
}

/* Save order to localStorage */
function saveOrderFromForm() {
  // gather
  const name = q('#nama').value.trim();
  if (!name) { alert('Isi nama lengkap pemesan dahulu'); return; }

  // validate passenger names
  const jumlah = Number(q('#jumlah').value) || 1;
  if (!Array.isArray(state.passengers) || state.passengers.length !== jumlah) {
    alert('Periksa nama penumpang terlebih dahulu.');
    return;
  }
  for (let i=0;i<state.passengers.length;i++){
    if (!state.passengers[i].name || !state.passengers[i].name.trim()) {
      alert(`Isi nama untuk Penumpang ${i+1}`);
      return;
    }
    if (!state.passengers[i].seat) {
      const confirmNoSeat = confirm(`Penumpang ${i+1} belum memilih kursi. Lanjut tanpa kursi?`);
      if (!confirmNoSeat) return;
    }
  }

  const order = {
    id: state.currentOrderId || ('SF' + Date.now().toString().slice(-7)),
    pemesan: name,
    nama: name,
    asal: q('#asal').value,
    tujuan: q('#tujuan').value,
    tanggal: q('#tanggal').value,
    jumlah: jumlah,
    maskapai: q('#maskapai').value,
    kelas: q('#kelas').value,
    totalText: q('#totalHarga').textContent,
    timestamp: new Date().toISOString(),
    paid: false,
    passengers: JSON.parse(JSON.stringify(state.passengers)) // clone
  };

  let arr = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');

  // mark seats as occupied globally (we won't enforce complex seat hold logic)
  // But we'll store order; rendering of seat map will treat seats in previous orders as occupied.
  arr.push(order);
  localStorage.setItem('skyfly_orders', JSON.stringify(arr));

  // prepare preview and go to riwayat
  state.currentOrderId = order.id;
  alert('Pesanan disimpan! (Belum dibayar)');
  // reset passenger inputs? keep them
  showPage('riwayatPage');
}

/* -------- Riwayat rendering -------- */
function renderRiwayat() {
  const container = q('#riwayatContainer');
  const arr = JSON.parse(localStorage.getItem('skyfly_orders') || '[]').slice().reverse();
  if (!arr.length) {
    container.innerHTML = `<div class="p-6 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">Belum ada riwayat pemesanan.</div>`;
    return;
  }

  container.innerHTML = '';
  arr.forEach((o) => {
    const item = document.createElement('div');
    item.className = 'p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 flex items-start justify-between gap-4';

    const passengersHtml = (o.passengers || []).map(p => `<div class="text-sm">• ${p.name} ${p.seat ? '('+p.seat+')' : ''}</div>`).join('');

    item.innerHTML = `
      <div>
        <div class="text-sm text-gray-500">${new Date(o.timestamp).toLocaleString()}</div>
        <div class="text-lg font-bold">${o.nama} — <span class="text-xs font-medium text-gray-500">${o.id}</span></div>
        <div class="text-sm text-gray-600 dark:text-gray-300">${o.asal} → ${o.tujuan} • ${o.kelas} • ${o.maskapai}</div>
        <div class="mt-2 text-sm">${passengersHtml}</div>
        <div class="mt-2 text-green-600 font-semibold">${o.totalText} ${o.paid ? '• (Lunas)' : '• (Belum bayar)'}</div>
      </div>
      <div class="flex flex-col gap-2 items-end">
        <button class="btn-outline" onclick='viewOrder("${o.id}")'>Lihat</button>
        ${o.paid ? `<button class="btn-outline" onclick='downloadOrderPdf("${o.id}")'>Cetak PDF</button>`
                 : `<button class="btn-primary-lg" onclick='payOrder("${o.id}")'>Bayar</button>`}
      </div>
    `;
    container.appendChild(item);
  });
}

/* view single order (load into preview & show pesan page) */
function viewOrder(id) {
  const arr = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');
  const o = arr.find(x => x.id === id);
  if (!o) return alert('Order tidak ditemukan');

  // fill form & preview
  q('#nama').value = o.nama;
  q('#asal').value = o.asal;
  q('#tujuan').value = o.tujuan;
  q('#tanggal').value = o.tanggal;
  q('#jumlah').value = o.jumlah;
  q('#maskapai').value = o.maskapai;
  q('#kelas').value = o.kelas;
  updateHarga();

  // passengers
  state.passengers = (o.passengers || []).map(p => ({ name: p.name, seat: p.seat }));
  state.currentOrderId = o.id;
  generatePassengerInputs(); // will populate inputs with state.passengers
  // fill passenger name values into inputs
  setTimeout(() => {
    state.passengers.forEach((p, i) => {
      const el = document.querySelector(`input[data-pass-index="${i}"]`);
      if (el) el.value = p.name || '';
      const lbl = q(`#seatLabel_${i}`);
      if (lbl) lbl.textContent = p.seat || '—';
    });
  }, 40);

  showPage('pesanPage');

  // mark as paid? show a small notice if paid
  if (o.paid) alert('Pesanan ini sudah dibayar.');
}

/* pay order from riwayat */
function payOrder(id) {
  // open payment modal and attach order id
  q('#paymentModal').classList.add('active');
  q('#confirmPaymentBtn').dataset.orderId = id;
}

/* -------- Payment modal actions -------- */
function openPaymentModal() {
  // ensure there's a current order (not yet saved)
  if (!state.currentOrderId) state.currentOrderId = 'SF' + Date.now().toString().slice(-7);

  // create quick unsaved order for payment convenience
  const tempOrder = {
    id: state.currentOrderId,
    nama: q('#nama').value || 'Guest',
    asal: q('#asal').value || '—',
    tujuan: q('#tujuan').value || '—',
    tanggal: q('#tanggal').value || '—',
    jumlah: Number(q('#jumlah').value) || 1,
    maskapai: q('#maskapai').value || '—',
    kelas: q('#kelas').value || '—',
    totalText: q('#totalHarga').textContent || 'Rp0',
    timestamp: new Date().toISOString(),
    paid: false,
    passengers: JSON.parse(JSON.stringify(state.passengers))
  };

  let arr = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');
  const exists = arr.find(x => x.id === tempOrder.id);
  if (!exists) { arr.push(tempOrder); localStorage.setItem('skyfly_orders', JSON.stringify(arr)); }

  q('#confirmPaymentBtn').dataset.orderId = tempOrder.id;
  q('#paymentModal').classList.add('active');
}

function closePaymentModal() {
  q('#paymentModal').classList.remove('active');
}

/* simulate payment */
function confirmPayment() {
  const btn = q('#confirmPaymentBtn');
  const method = btn.dataset.method || 'Metode';
  const orderId = btn.dataset.orderId;
  if (!orderId) return alert('Tidak ada order untuk dibayar.');

  btn.disabled = true;
  btn.textContent = 'Memproses...';

  // fake processing
  setTimeout(() => {
    // mark order as paid in localStorage
    let arr = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');
    const idx = arr.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      arr[idx].paid = true;
      arr[idx].paidMethod = method;
      arr[idx].paidAt = new Date().toISOString();
      localStorage.setItem('skyfly_orders', JSON.stringify(arr));
    }
    btn.disabled = false;
    btn.textContent = 'Bayar (Simulasi)';
    closePaymentModal();
    alert(`Pembayaran berhasil via ${method} (simulasi). Tiket siap dicetak.`);

    // load that order in preview
    viewOrder(orderId);
    // auto generate pdf ready
    renderRiwayat();
  }, 1200);
}

/* -------- PDF & Print functions -------- */
async function downloadTicketPdf() {
  const el = q('#ticketPreview');
  if (!el) return alert('Tidak ada tiket untuk diunduh.');

  // update preview timestamp/name before capture
  updatePreview();

  await html2canvas(el, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    const name = (q('#orderIdPreview').textContent || 'ticket') + '.pdf';
    pdf.save(name);
  }).catch(err => {
    console.error(err);
    alert('Gagal membuat PDF.');
  });
}

function printTicket() {
  const printWindow = window.open('', '_blank');
  const el = q('#ticketPreview').cloneNode(true);

  // inline styles for simple print
  const html = `
    <html><head><title>Print Ticket</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}</style>
    </head><body>${el.outerHTML}</body></html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
}

/* Download PDF for selected order from riwayat */
function downloadOrderPdf(orderId) {
  // load order into preview and then trigger download
  viewOrder(orderId);
  setTimeout(() => {
    downloadTicketPdf();
  }, 400);
}

/* pay from riwayat: open modal */
function payOrder(orderId) {
  q('#paymentModal').classList.add('active');
  q('#confirmPaymentBtn').dataset.orderId = orderId;
  // highlight first method
  qAll('.pay-method')[0]?.click();
}

/* ===== Seat selection modal & logic ===== */

/*
  Seat layout model:
  - We'll generate rows 1..20 (or fewer depending kelas), with seats A,B,C aisle D,E,F
  - seat id example: "12A", "12B", etc.
  - We'll compute occupied seats from orders in localStorage (all orders, paid or not)
*/

function buildSeatLayout(rows = 20) {
  const layout = [];
  const cols = ['A','B','C','','D','E','F']; // empty string for aisle placeholder
  for (let r=1;r<=rows;r++){
    const row = cols.map(c => c === '' ? null : { id: `${r}${c}`, row: r, col: c });
    layout.push(row);
  }
  return layout;
}

// open seat modal; optional passengerIndex to highlight specific passenger
function openSeatModal(passengerIndex = null) {
  // ensure passenger array matches jumlah
  generatePassengerInputs();

  // build layout (economy: 20 rows default, bisnis/first can be fewer but for demo keep 20)
  state.seatLayout = buildSeatLayout(20);

  // compute occupied seats from localStorage orders
  const orders = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');
  const occupied = new Set();
  orders.forEach(o => {
    (o.passengers || []).forEach(p => {
      if (p.seat) occupied.add(p.seat);
    });
  });

  // assign any previously chosen seats in current state to be reserved (not blocked)
  // Render passenger list
  renderPassengerListForSeatModal();

  // render seat map
  renderSeatMap(occupied);

  // optionally select a passenger
  if (typeof passengerIndex === 'number') {
    state.selectedPassengerIndex = passengerIndex;
    highlightSelectedPassenger();
  } else {
    state.selectedPassengerIndex = 0; // default to first
    highlightSelectedPassenger();
  }

  q('#seatModal').classList.add('active');
}

function closeSeatModal() {
  q('#seatModal').classList.remove('active');
  state.selectedPassengerIndex = null;
}

// render passenger list inside modal
function renderPassengerListForSeatModal() {
  const container = q('#passengerList');
  container.innerHTML = '';
  const passengers = state.passengers || [];
  if (!passengers.length) {
    container.innerHTML = `<div class="text-sm text-gray-500">Belum ada penumpang. Tambah jumlah tiket dulu.</div>`;
    return;
  }
  passengers.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'passenger-item';
    div.dataset.idx = i;
    div.innerHTML = `<div>${i+1}. ${p.name || '—'}</div><div class="text-xs text-gray-500">${p.seat || '—'}</div>`;
    div.addEventListener('click', () => {
      state.selectedPassengerIndex = i;
      highlightSelectedPassenger();
      // visually indicate selected passenger
      qAll('.seat.selected').forEach(s => s.classList.remove('selected'));
    });
    container.appendChild(div);
  });
  highlightSelectedPassenger();
}

function highlightSelectedPassenger() {
  qAll('.passenger-item').forEach(el => el.classList.remove('active'));
  const idx = state.selectedPassengerIndex;
  if (idx === null || idx === undefined) return;
  const el = q(`.passenger-item[data-idx="${idx}"]`);
  if (el) el.classList.add('active');
}

// render seat map; occupied is Set of seat ids
function renderSeatMap(occupiedSet) {
  const seatMapEl = q('#seatMap');
  seatMapEl.innerHTML = '';

  state.seatLayout.forEach((rowArr) => {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'seat-row';

    // left block (ABC)
    const leftBlock = document.createElement('div');
    leftBlock.className = 'seat-col';
    rowArr.slice(0,3).forEach(seatObj => {
      leftBlock.appendChild(renderSeatNode(seatObj, occupiedSet));
    });

    // aisle placeholder
    const aisle = document.createElement('div');
    aisle.style.width = '24px';
    aisle.innerHTML = `<div class="text-xs text-gray-400">${rowArr[0] ? rowArr[0].row : ''}</div>`;

    // right block (DEF)
    const rightBlock = document.createElement('div');
    rightBlock.className = 'seat-col';
    rowArr.slice(3).forEach(seatObj => {
      rightBlock.appendChild(renderSeatNode(seatObj, occupiedSet));
    });

    rowWrapper.appendChild(leftBlock);
    rowWrapper.appendChild(aisle);
    rowWrapper.appendChild(rightBlock);
    seatMapEl.appendChild(rowWrapper);
  });
}

// create seat DOM node
function renderSeatNode(seatObj, occupiedSet) {
  const node = document.createElement('div');
  if (!seatObj) {
    const empty = document.createElement('div');
    empty.className = 'seat aisle';
    empty.textContent = '';
    return empty;
  }
  node.className = 'seat available';
  node.textContent = seatObj.id;

  // if occupied by any stored order (not including current state's own assigned seats), mark occupied
  const isOccupied = occupiedSet.has(seatObj.id);
  // But allow if the same seat is already assigned in current state (so user can keep it)
  const isAssignedInState = state.passengers.some(p => p.seat === seatObj.id);

  if (isOccupied && !isAssignedInState) {
    node.classList.remove('available');
    node.classList.add('occupied');
    node.title = 'Sudah terisi';
  } else if (isAssignedInState) {
    node.classList.remove('available');
    node.classList.add('assigned');
    const passenger = state.passengers.find(p => p.seat === seatObj.id);
    node.textContent = seatObj.id;
    node.title = passenger ? `Terisi oleh ${passenger.name}` : seatObj.id;
  } else {
    node.title = 'Tersedia';
  }

  node.addEventListener('click', () => {
    // if occupied by others, do nothing
    if (node.classList.contains('occupied')) return;
    // must have selected passenger index
    const idx = state.selectedPassengerIndex;
    if (idx === null || idx === undefined) {
      alert('Pilih penumpang dulu di sebelah kiri.');
      return;
    }
    // if seat already assigned to someone else in state, remove it first
    const alreadyAssignedIdx = state.passengers.findIndex(p => p.seat === seatObj.id);
    if (alreadyAssignedIdx !== -1 && alreadyAssignedIdx !== idx) {
      const ok = confirm(`Kursi ${seatObj.id} sudah dipilih oleh Penumpang ${alreadyAssignedIdx+1}. Ganti?`);
      if (!ok) return;
      state.passengers[alreadyAssignedIdx].seat = null;
    }
    // assign seat to selected passenger
    state.passengers[idx].seat = seatObj.id;
    // update seat labels in the form
    const lbl = q(`#seatLabel_${idx}`);
    if (lbl) lbl.textContent = seatObj.id;
    // re-render passenger list & seat map to reflect changes
    renderPassengerListForSeatModal();
    // rebuild occupied set to treat assigned seats as assigned
    const orders = JSON.parse(localStorage.getItem('skyfly_orders') || '[]');
    const occ = new Set();
    orders.forEach(o => (o.passengers||[]).forEach(p => { if (p.seat) occ.add(p.seat); }));
    renderSeatMap(occ);
    // maintain selection highlight
    highlightSelectedPassenger();
  });

  return node;
}

// Confirm seats (close modal)
function confirmSeats() {
  // simple validation: ensure each passenger has a seat (optional)
  // We will allow incomplete seats but warn
  const missing = state.passengers.filter(p => !p.seat);
  if (missing.length > 0) {
    const ok = confirm(`Masih ada ${missing.length} penumpang tanpa kursi. Simpan tanpa kursi?`);
    if (!ok) return;
  }
  updatePreview();
  closeSeatModal();
}

// clear seat assignments for current passengers
function clearSeatAssignments() {
  if (!state.passengers) return;
  state.passengers.forEach(p => p.seat = null);
  generatePassengerInputs();
  updatePreview();
  alert('Semua pilihan kursi dihapus untuk pesanan ini.');
}
