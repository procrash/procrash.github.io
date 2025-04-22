/**
 * app.js
 * Hauptdatei für die Wildkamera-PWA mit Integration aller Module
 */

// Globale Variablen
let currentCameraId = null;
let cameras = [];

// PWA-Funktionalität
let deferredPrompt;
const installButton = document.getElementById('installButton');

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('Service Worker registriert:', reg))
      .catch(err => console.error('Service Worker Registrierung fehlgeschlagen:', err));
  });
}

// PWA Installation ermöglichen
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.classList.remove('hide');
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Installation Ergebnis: ${outcome}`);
  deferredPrompt = null;
  installButton.classList.add('hide');
});
window.addEventListener('appinstalled', () => {
  console.log('PWA wurde installiert');
  installButton.classList.add('hide');
});

// DOMContentLoaded: Module holen & initialisieren
document.addEventListener('DOMContentLoaded', async () => {
  const dbManager   = window.dbManager;
  const smsManager  = window.smsManager;
  const syncManager = window.syncManager;

  initMaterializeComponents();
  setupBottomNavigation();
  setupEventListeners();

  await loadCameras();
  await syncManager.checkPendingSMS();
  syncManager.setupNetworkStatus();
});

// Materialize Komponenten initialisieren
function initMaterializeComponents() {
  M.Modal.init(document.querySelectorAll('.modal'));
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.Timepicker.init(document.querySelectorAll('.timepicker'), { twelveHour: false, defaultTime: '00:00', autoClose: true });
  M.Range.init(document.querySelectorAll('input[type=range]'));
}

// Bottom Navigation Setup
function setupBottomNavigation() {
  const navCameras  = document.getElementById('navCameras');
  const navSettings = document.getElementById('navSettings');

  navCameras.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('.main-container').style.display = 'block';
    navCameras.classList.add('active');
    navSettings.classList.remove('active');
  });
  navSettings.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('.main-container').style.display = 'none';
    navSettings.classList.add('active');
    navCameras.classList.remove('active');
  });
}

// Event-Listener für Buttons einrichten
function setupEventListeners() {
  document.getElementById('addCameraButton').addEventListener('click', () => openCameraModal());
  document.getElementById('saveCameraButton').addEventListener('click', saveCamera);
  document.getElementById('sendSettingsButton').addEventListener('click', sendSettings);
  document.getElementById('settingsModal').addEventListener('show', () => initializeSettingsForm());

  const burstSlider = document.getElementById('burstImages');
  if (burstSlider) burstSlider.addEventListener('input', () => updateSmsPreview());
  document.querySelectorAll('#settingsModal input, #settingsModal select')
    .forEach(el => el.addEventListener('change', updateSmsPreview));
}

// Kamera Modal öffnen (add/rename)
function openCameraModal(camera = null) {
  document.getElementById('modalTitle').textContent = camera ? 'Kamera umbenennen' : 'Kamera hinzufügen';
  document.getElementById('cameraName').value  = camera ? camera.name : '';
  document.getElementById('cameraPhone').value = camera ? camera.phone : '';
  currentCameraId = camera ? camera.id : null;
  M.Modal.getInstance(document.getElementById('cameraModal')).open();
}

// Kamera speichern
async function saveCamera() {
  const name  = document.getElementById('cameraName').value.trim();
  const phone = document.getElementById('cameraPhone').value.trim();
  if (!name || !phone) return M.toast({ html: 'Bitte alle Felder ausfüllen', classes: 'toast-error' });
  if (!isValidPhoneNumber(phone)) return M.toast({ html: 'Bitte gültige Telefonnummer eingeben', classes: 'toast-error' });

  try {
    const cam = { id: currentCameraId || Date.now().toString(), name, phone, type: document.getElementById('cameraType').value };
    await dbManager.saveCamera(cam);
    if (!currentCameraId) cameras.push(cam);
    else cameras = cameras.map(c => c.id === cam.id ? cam : c);
    M.toast({ html: currentCameraId ? 'Kamera aktualisiert' : 'Kamera hinzugefügt', classes: 'toast-success' });
    M.Modal.getInstance(document.getElementById('cameraModal')).close();
    renderCameraList();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Fehler beim Speichern', classes: 'toast-error' });
  }
}

// Kameras laden
async function loadCameras() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hide');
    cameras = await dbManager.getAllCameras();
    renderCameraList();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Fehler beim Laden der Kameras', classes: 'toast-error' });
  } finally {
    document.getElementById('loadingIndicator').classList.add('hide');
  }
}

// Kameras alphabetisch und einzeilig rendern
function renderCameraList() {
  const list = document.getElementById('cameraList'); list.innerHTML = '';
  cameras.sort((a, b) => a.name.localeCompare(b.name)).forEach(addCameraToUI);
  if (!cameras.length) list.innerHTML = `<div class="empty-message">Keine Kameras vorhanden.</div>`;
}

// Einzeilige UI für eine Kamera ohne Typ-Anzeige
function addCameraToUI(camera) {
  const list = document.getElementById('cameraList');
  const item = document.createElement('div'); item.className = 'camera-list-item'; item.dataset.id = camera.id;
  item.innerHTML = `
    <div class="camera-list-header">
      <i class="material-icons camera-icon">photo_camera</i>
      <div class="camera-info">
        <h5 class="camera-name">${camera.name}</h5>
        <p class="camera-phone">${camera.phone}</p>
      </div>
    </div>
    <div class="camera-actions">
      <i class="material-icons camera-action" data-action="settings">settings</i>
      <i class="material-icons camera-action" data-action="rename">edit</i>
      <i class="material-icons camera-action" data-action="photo">photo</i>
      <i class="material-icons camera-action" data-action="delete">delete</i>
    </div>`;
  list.appendChild(item);
  setupCameraActions(item, camera);
}

// Aktionen für Kamera-Items
function setupCameraActions(item, camera) {
  item.querySelectorAll('.camera-action').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation(); const action = btn.dataset.action;
    if (action==='settings') openSettingsModal(camera);
    if (action==='rename')   openCameraModal(camera);
    if (action==='photo')    requestPhoto(camera);
    if (action==='delete')   deleteCamera(camera);
  }));
}

// Foto anfordern
async function requestPhoto(camera) {
  const smsText = buildSmsCommand('photo');
  const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
  M.toast({ html: sent?'Foto angefordert':'Fehler', classes: sent?'toast-success':'toast-error' });
}

// Kamera löschen
async function deleteCamera(camera) {
  if (!confirm(`Löschen: ${camera.name}?`)) return;
  await dbManager.deleteCamera(camera.id);
  cameras = cameras.filter(c=>c.id!==camera.id);
  renderCameraList();
  M.toast({ html:'Kamera gelöscht', classes:'toast-success' });
}

// Einstellungen Modal öffnen & befüllen
async function openSettingsModal(camera) {
  currentCameraId = camera.id;
  const settings = await dbManager.getSettings(camera.id) || {};
  initializeSettingsForm();
  Object.entries(settings).forEach(([key,val]) => { const el=document.getElementById(key); if(el){ if(el.type==='checkbox')el.checked=val; else el.value=val; } });
  M.FormSelect.init(document.querySelectorAll('#settingsModal select'));
  M.updateTextFields();
  updateSmsPreview();
  M.Modal.getInstance(document.getElementById('settingsModal')).open();
}

function initializeSettingsForm() {
  // Default-Werte in einem Objekt
  const defaults = {
    smsControl:        'Täglich',
    imageSize:         'Original',
    statusTime:        '00:00',
    statusReportSwitch: true,
    maxCount:          'Kein Limit',
    maxCountSwitch:    false,
    mmsControlSwitch:  false,
    smtpSwitch:        true,
    ftpMode:           'AUS',
    sendImageSwitch:   true,
    sendVideoSwitch:   false,
    captureMode:       'Bild',
    nightMode:         'Balance',
    imageResolution:   '24M',
    videoResolution:   'FHD-1920x1080',
    pirSensitivity:    'Hoch',
    flashLed:          'Hoch',
    videoDuration:     '5s',
    hourSystem:        '24h',
    burstImages:       1,
    motionSensorSwitch:true,
    sdCycleSwitch:     true,
    // Timer-Felder ...
    timer1Start:       '00:00',
    timer1End:         '00:00',
    timer1Switch:      false,
    // ... usw. ...
    phone1:            '',
    email1:            ''
  };

  // Loop über alle Defaults
  Object.entries(defaults).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return; // wenn Element nicht existiert, skip
    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else {
      el.value = value;
      if (el.tagName === 'SELECT') {
        M.FormSelect.init(el);
      }
    }
  });

  // Range-Slider und Text-Field-Labels noch einmal updaten
  const burst = document.getElementById('burstImages');
  if (burst) {
    document.getElementById('burstImagesValue').textContent = burst.value + 'P';
  }
  M.updateTextFields();
}

// SMS-Befehl aus Form generieren
function buildSmsCommand(type) {
  const form = getSettingsFromForm();
  switch(type) {
    case 'photo': return 'PHOTO';
    case 'general': return `SET ${form.smsControl}`;
    case 'camera': return `CAM ${form.captureMode} ${form.burstImages}`;
    default: return '';
  }
}

// Settings-Formulardaten auslesen
function getSettingsFromForm() {
  return {
    smsControl: document.getElementById('smsControl').value,
    captureMode: document.getElementById('captureMode').value,
    burstImages: document.getElementById('burstImages').value
    // weitere Felder...
  };
}

// SMS-Vorschau aktualisieren
function updateSmsPreview() {
  const smsPreview = document.getElementById('smsPreviewText');
  const preview = buildSmsCommand('camera');
  smsPreview.textContent = preview;
}

// Settings senden
async function sendSettings() {
  const camera = cameras.find(c=>c.id===currentCameraId);
  if(!camera) return;
  const settings = getSettingsFromForm();
  await dbManager.saveSettings(camera.id, settings);
  const text = buildSmsCommand('camera');
  await smsManager.sendSms(camera.phone, text, camera.id);
  M.toast({ html:'Einstellungen gesendet', classes:'toast-success' });
  M.Modal.getInstance(document.getElementById('settingsModal')).close();
}

// Hilfsfunktion: Telefonnummer validieren
function isValidPhoneNumber(phoneNumber) {
  return /^\+?[0-9]{8,15}$/.test(phoneNumber);
}

// Netzwerk & Sync Wrapper
async function syncPendingSMS()        { return syncManager.syncPendingSMS(); }
function setupNetworkStatus()          { return syncManager.setupNetworkStatus(); }
