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
  const dbManager      = window.dbManager;
  const smsManager     = window.smsManager;
  const uiExtensions   = window.uiExtensions;
  const cameraSettings = window.cameraSettings;
  const syncManager    = window.syncManager;

  initMaterializeComponents();
  setupBottomNavigation();
  setupEventListeners();

  await loadCameras();

  await syncManager.checkPendingSMS();
  syncManager.setupNetworkStatus();

  uiExtensions.setupBatchOperations();
  uiExtensions.setupDragAndDropSorting();
  cameraSettings.setupLiveSettingsPreview();
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
  document.getElementById('addCameraButton').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Kamera hinzufügen';
    document.getElementById('cameraName').value   = '';
    document.getElementById('cameraPhone').value  = '';
    document.getElementById('cameraType').value   = 'Standard';
    M.FormSelect.init(document.getElementById('cameraType'));
    M.updateTextFields();

    currentCameraId = null;
    M.Modal.getInstance(document.getElementById('cameraModal')).open();
  });
  document.getElementById('saveCameraButton').addEventListener('click', saveCamera);
  document.getElementById('sendSettingsButton').addEventListener('click', sendSettings);

  const burstSlider = document.getElementById('burstImages');
  if (burstSlider) burstSlider.addEventListener('input', () => {
    document.getElementById('burstImagesValue').textContent = burstSlider.value + 'P';
    updateSmsPreview();
  });
  document.querySelectorAll('#settingsModal input, #settingsModal select')
    .forEach(el => el.addEventListener('change', updateSmsPreview));
}

// Kamera speichern
async function saveCamera() {
  const name  = document.getElementById('cameraName').value.trim();
  const phone = document.getElementById('cameraPhone').value.trim();
  if (!name || !phone) return M.toast({ html: 'Bitte alle Felder ausfüllen', classes: 'toast-error' });
  if (!isValidPhoneNumber(phone)) return M.toast({ html: 'Bitte gültige Telefonnummer eingeben', classes: 'toast-error' });

  try {
    if (!currentCameraId) {
      const cam = { id: Date.now().toString(), name, phone, type: document.getElementById('cameraType').value };
      await dbManager.saveCamera(cam);
      cameras.push(cam);
      M.toast({ html: 'Kamera hinzugefügt', classes: 'toast-success' });
    } else {
      const idx = cameras.findIndex(c => c.id === currentCameraId);
      if (idx !== -1) {
        const updated = { ...cameras[idx], name, phone };
        await dbManager.saveCamera(updated);
        cameras[idx] = updated;
        M.toast({ html: 'Kamera aktualisiert', classes: 'toast-success' });
      }
    }
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
  const list = document.getElementById('cameraList');
  list.innerHTML = '';
  const sorted = cameras.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!sorted.length) {
    list.innerHTML = `<div class="empty-message">Keine Kameras vorhanden. + anklicken, um eine hinzuzufügen.</div>`;
    return;
  }
  sorted.forEach(addCameraToUI);
}

// Einzeilige UI für eine Kamera ohne Typ-Anzeige
function addCameraToUI(camera) {
  const list = document.getElementById('cameraList');
  const item = document.createElement('div');
  item.className = 'camera-list-item';
  item.dataset.id = camera.id;
  item.innerHTML = `
    <div class="camera-list-header">
      <div class="camera-icon"><i class="material-icons">photo_camera</i></div>
      <div class="camera-info">
        <h5 class="camera-name">${camera.name}</h5>
        <p class="camera-phone">${camera.phone}</p>
      </div>
    </div>
    <div class="camera-actions">
      <div class="camera-action" data-action="settings"><i class="material-icons action-icon">settings</i></div>
      <div class="camera-action" data-action="rename"><i class="material-icons action-icon">edit</i></div>
      <div class="camera-action" data-action="photo"><i class="material-icons action-icon">photo</i></div>
      <div class="camera-action" data-action="delete"><i class="material-icons action-icon">delete</i></div>
    </div>`;
  list.appendChild(item);
  setupCameraActions(item, camera);
}

// Aktionen für Kamera-Items
function setupCameraActions(item, camera) {
  item.querySelectorAll('.camera-action').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'settings') openSettingsModal(camera);
      if (action === 'rename')   openRenameModal(camera);
      if (action === 'photo')    requestPhoto(camera);
      if (action === 'delete')   confirmDeleteCamera(camera);
    });
  });
}

// Rename-Modal
function openRenameModal(camera) {
  currentCameraId = camera.id;
  document.getElementById('modalTitle').textContent = 'Kamera umbenennen';
  document.getElementById('cameraName').value  = camera.name;
  document.getElementById('cameraPhone').value = camera.phone;
  M.FormSelect.init(document.getElementById('cameraType'));
  M.updateTextFields();
  M.Modal.getInstance(document.getElementById('cameraModal')).open();
}

// Foto anfordern
async function requestPhoto(camera) {
  const smsText = cameraSettings.buildSmsCommand('photo');
  const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
  M.toast({ html: sent ? 'Foto angefordert' : 'Fehler beim Anfordern', classes: sent ? 'toast-success' : 'toast-error' });
}

// Kamera löschen
function confirmDeleteCamera(camera) {
  if (confirm(`Kamera "${camera.name}" löschen?`)) deleteCamera(camera.id);
}
async function deleteCamera(id) {
  await dbManager.deleteCamera(id);
  cameras = cameras.filter(c => c.id !== id);
  renderCameraList();
}

// Modul-Wrapper
async function openSettingsModal(camera) { return cameraSettings.openSettingsModal(camera); }
function updateSmsPreview()            { return cameraSettings.updateSmsPreview();                 }
async function syncPendingSMS()        { return syncManager.syncPendingSMS();                     }
function setupNetworkStatus()          { return syncManager.setupNetworkStatus();                 }
