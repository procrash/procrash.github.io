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
            .then(registration => console.log('Service Worker registriert:', registration))
            .catch(error => console.error('Service Worker Registrierung fehlgeschlagen:', error));
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

  uiExtensions.setupCameraListFiltering();
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
        document.getElementById('cameraName').value = '';
        document.getElementById('cameraPhone').value = '';
        document.getElementById('cameraType').value = 'Standard';
        M.FormSelect.init(document.getElementById('cameraType'));
        M.updateTextFields();
        currentCameraId = null;
        M.Modal.getInstance(document.getElementById('cameraModal')).open();
    });

    document.getElementById('saveCameraButton').addEventListener('click', saveCamera);
    document.getElementById('sendSettingsButton').addEventListener('click', sendSettings);

    const burstSlider = document.getElementById('burstImages');
    if (burstSlider) {
        burstSlider.addEventListener('input', () => {
            document.getElementById('burstImagesValue').textContent = burstSlider.value + 'P';
            updateSmsPreview();
        });
    }

    document.querySelectorAll('#settingsModal input, #settingsModal select')
      .forEach(el => el.addEventListener('change', updateSmsPreview));
}

// Kamera speichern
async function saveCamera() {
    const name  = document.getElementById('cameraName').value.trim();
    const phone = document.getElementById('cameraPhone').value.trim();
    const type  = document.getElementById('cameraType').value;

    if (!name || !phone) {
        return M.toast({ html: 'Bitte alle Felder ausfüllen', classes: 'toast-error' });
    }
    if (!isValidPhoneNumber(phone)) {
        return M.toast({ html: 'Bitte gültige Telefonnummer eingeben', classes: 'toast-error' });
    }

    try {
        if (currentCameraId === null) {
            const cam = { id: Date.now().toString(), name, phone, type };
            await window.dbManager.saveCamera(cam);
            cameras.push(cam);
            addCameraToUI(cam);
            M.toast({ html: 'Kamera hinzugefügt', classes: 'toast-success' });
        } else {
            const idx = cameras.findIndex(c => c.id === currentCameraId);
            if (idx !== -1) {
                const updated = { ...cameras[idx], name, phone, type };
                await window.dbManager.saveCamera(updated);
                cameras[idx] = updated;
                updateCameraInUI(updated);
                M.toast({ html: 'Kamera aktualisiert', classes: 'toast-success' });
            }
        }
        M.Modal.getInstance(document.getElementById('cameraModal')).close();
    } catch (err) {
        console.error(err);
        M.toast({ html: 'Fehler beim Speichern', classes: 'toast-error' });
    }
}

// Kameras laden
async function loadCameras() {
    try {
        document.getElementById('loadingIndicator').classList.remove('hide');
        cameras = await window.dbManager.getAllCameras();
        if (!cameras.length) {
            const demo = [
                { id: '1', name: 'Werner Kamera Schütt', phone: '01757164718', type: 'Pro' },
                { id: '2', name: 'Hirschmüller Links', phone: '00319703780580', type: 'Pro' },
                { id: '3', name: 'democam', phone: '01609760483', type: 'Max' }
            ];
            for (const d of demo) await window.dbManager.saveCamera(d);
            cameras = demo;
        }
        renderCameraList();
    } catch (err) {
        console.error(err);
        M.toast({ html: 'Fehler beim Laden der Kameras', classes: 'toast-error' });
    } finally {
        document.getElementById('loadingIndicator').classList.add('hide');
    }
}

// Kameras in UI anzeigen
function renderCameraList() {
    const list = document.getElementById('cameraList');
    list.innerHTML = '';
    if (!cameras.length) {
        list.innerHTML = `
          <div class="center-align" style="padding:30px;">
            <i class="material-icons large" style="color:#ccc;">photo_camera</i>
            <p>Keine Kameras vorhanden. Klick auf + zum Hinzufügen.</p>
          </div>`;
        return;
    }
    cameras.forEach(addCameraToUI);
}

// Einzelne Kamera-Item erstellen
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
          <p class="camera-phone">Telefonnummer: ${camera.phone}</p>
        </div>
        <span class="camera-badge">${camera.type}</span>
      </div>
      <div class="camera-actions">
        <div class="camera-action" data-action="settings"><i class="material-icons action-icon">settings</i><span>Einstellungen</span></div>
        <div class="camera-action" data-action="rename"><i class="material-icons action-icon">edit</i><span>Umbenennen</span></div>
        <div class="camera-action" data-action="photo"><i class="material-icons action-icon">photo</i><span>Bild anfordern</span></div>
        <div class="camera-action" data-action="delete"><i class="material-icons action-icon">delete</i><span>Löschen</span></div>
      </div>`;
    list.appendChild(item);
    setupCameraActions(item, camera);
}

// UI aktualisieren
function updateCameraInUI(camera) {
    const item = document.querySelector(`.camera-list-item[data-id="${camera.id}"]`);
    if (!item) return;
    item.querySelector('.camera-name').textContent = camera.name;
    item.querySelector('.camera-phone').textContent = `Telefonnummer: ${camera.phone}`;
    item.querySelector('.camera-badge').textContent = camera.type;
}

// Klick-Aktionen an Kamera-Items
function setupCameraActions(item, camera) {
    item.querySelectorAll('.camera-action').forEach(actionEl => {
        actionEl.addEventListener('click', e => {
            e.stopPropagation();
            const type = actionEl.dataset.action;
            switch (type) {
                case 'settings': openSettingsModal(camera); break;
                case 'rename':   openRenameModal(camera); break;
                case 'photo':    requestPhoto(camera); break;
                case 'delete':   confirmDeleteCamera(camera); break;
            }
        });
    });
}

// Rename-Modal
function openRenameModal(camera) {
    currentCameraId = camera.id;
    document.getElementById('modalTitle').textContent = 'Kamera umbenennen';
    document.getElementById('cameraName').value  = camera.name;
    document.getElementById('cameraPhone').value = camera.phone;
    document.getElementById('cameraType').value  = camera.type;
    M.FormSelect.init(document.getElementById('cameraType'));
    M.updateTextFields();
    M.Modal.getInstance(document.getElementById('cameraModal')).open();
}

// Foto anfordern
async function requestPhoto(camera) {
    const sms = window.cameraSettings.buildSmsCommand('photo');
    try {
        const sent = await window.smsManager.sendSms(camera.phone, sms, camera.id);
        const msg = sent ? 'Foto angefordert' : (!navigator.onLine ? 'Offline: gesendet, wenn online' : 'wird im Hintergrund gesendet');
        M.toast({ html: `${msg} von ${camera.name}`, classes: 'toast-success' });
    } catch (err) {
        console.error(err);
        M.toast({ html: 'Fehler beim Anfordern des Fotos', classes: 'toast-error' });
    }
}

// Löschen bestätigen & aus DB
function confirmDeleteCamera(camera) {
    if (confirm(`Löschen "${camera.name}"?`)) deleteCamera(camera.id);
}

async function deleteCamera(id) {
    try {
        await window.dbManager.deleteCamera(id);
        cameras = cameras.filter(c => c.id !== id);
        document.querySelector(`.camera-list-item[data-id="${id}"]`).remove();
        if (!cameras.length) renderCameraList();
        M.toast({ html: 'Kamera gelöscht', classes: 'toast-success' });
    } catch (err) {
        console.error(err);
        M.toast({ html: 'Fehler beim Löschen der Kamera', classes: 'toast-error' });
    }
}

// Einstellungen-Formulare
function initializeSettingsForm() {
    const defaults = {
        smsControl: 'Täglich', imageSize: 'Original', statusTime: '00:00', statusReportSwitch: true,
        maxCount: 'Kein Limit', maxCountSwitch: false, mmsControlSwitch: false, smtpSwitch: true, ftpMode: 'AUS',
        sendImageSwitch: true, sendVideoSwitch: false, captureMode: 'Bild', nightMode: 'Balance',
        imageResolution: '24M', videoResolution: 'FHD-1920x1080', pirSensitivity: 'Hoch', flashLed: 'Hoch',
        videoDuration: '5s', hourSystem: '24h', burstImages: 1, motionSensorSwitch: true, sdCycleSwitch: true,
        timer1Switch: false, timer1Start: '00:00', timer1End: '00:00', timer2Switch: false, timer2Start: '00:00',
        timer2End: '00:00', delaySwitch: false, delayTime: '00:00:00', timelapseSwitch: false, timelapseTime: '00:00:00',
        phone1: '', email1: ''
    };
    Object.entries(defaults).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = val;
        else el.value = val;
        if (el.tagName === 'SELECT') M.FormSelect.init(el);
    });
    M.updateTextFields();
}

function fillSettingsForm(settings) {
    initializeSettingsForm();
    Object.entries(settings).forEach(([key, val]) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = val;
        else el.value = val;
        if (el.tagName === 'SELECT') M.FormSelect.init(el);
    });
    if (settings.burstImages) document.getElementById('burstImagesValue').textContent = settings.burstImages + 'P';
    M.updateTextFields();
}

function getSettingsFromForm() {
    const ids = ['smsControl','imageSize','statusTime','statusReportSwitch','maxCount','maxCountSwitch',
        'mmsControlSwitch','smtpSwitch','ftpMode','sendImageSwitch','sendVideoSwitch','captureMode',
        'nightMode','imageResolution','videoResolution','pirSensitivity','flashLed','videoDuration',
        'hourSystem','burstImages','motionSensorSwitch','sdCycleSwitch','timer1Switch','timer1Start',
        'timer1End','timer2Switch','timer2Start','timer2End','delaySwitch','delayTime','timelapseSwitch',
        'timelapseTime','phone1','email1'];
    const settings = {};
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        settings[id] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    return settings;
}

async function sendSettings() {
    const camera = cameras.find(c => c.id === currentCameraId);
    if (!camera) return;
    const settings = getSettingsFromForm();
    await window.dbManager.saveSettings(camera.id, settings).catch(err => console.error(err));
    const tab = Array.from(document.querySelectorAll('.tabs .tab a')).find(a => a.classList.contains('active'));    
    const type = tab?.getAttribute('href').slice(1) || 'generalSettings';
    const smsText = window.cameraSettings.buildSmsCommand(
        type === 'cameraSettings' ? 'camera' : type === 'timerSettings' ? 'timer' : 'general'
    );
    try {
        const sent = await window.smsManager.sendSms(camera.phone, smsText, camera.id);
        const cls = sent ? 'toast-success' : (!navigator.onLine ? 'toast-info' : 'toast-info');
        M.toast({ html: `${sent ? 'Gesendet an' : (!navigator.onLine ? 'Offline, wird gesendet' : 'Wird gesendet')} ${camera.name}`, classes: cls });
        M.Modal.getInstance(document.getElementById('settingsModal')).close();
    } catch (err) {
        console.error(err);
        M.toast({ html: 'Fehler beim Senden der Einstellungen', classes: 'toast-error' });
    }
}

// Hilfsfunktion: Telefonnummer validieren
function isValidPhoneNumber(phoneNumber) {
    return /^\+?[0-9]{8,15}$/.test(phoneNumber);
}

// Modul-Wrapper
async function openSettingsModal(camera)        { return window.cameraSettings.openSettingsModal(camera); }
function updateSmsPreview()                      { return window.cameraSettings.updateSmsPreview();         }
async function syncPendingSMS()                  { return window.syncManager.syncPendingSMS();             }
function setupNetworkStatus()                    { return window.syncManager.setupNetworkStatus();         }
