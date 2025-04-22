/**
 * app.js
 * Hauptdatei für die Wildkamera-PWA mit Integration aller Module
 */

// Globale Variablen
let currentCameraId = null;
let cameras = [];

// Datenbank- und SMS-Manager
// let dbManager;
// let smsManager;

// PWA-Funktionalität
let deferredPrompt;
const installButton = document.getElementById('installButton');

// Service Worker registrieren
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registriert:', registration);
            })
            .catch(error => {
                console.error('ServiceWorker Registrierung fehlgeschlagen:', error);
            });
    });
}

// PWA Installation ermöglichen
window.addEventListener('beforeinstallprompt', (e) => {
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

// DOM geladen
document.addEventListener('DOMContentLoaded', async () => {
    // Manager initialisieren
    dbManager = window.dbManager;
    smsManager = window.smsManager;
    
    // Materialize-Komponenten initialisieren
    initMaterializeComponents();
    
    // Bottom Navigation einrichten
    setupBottomNavigation();
    
    // Event-Listener für die Buttons einrichten
    setupEventListeners();
    
    // Kameras laden
    await loadCameras();
    
    // Nach pendingSMS schauen
    checkPendingSMS();
    
    // Online/Offline-Status überwachen
    setupNetworkStatus();
});


// Materialize Komponenten initialisieren
function initMaterializeComponents() {
    // Modals
    const modals = document.querySelectorAll('.modal');
    M.Modal.init(modals);
    
    // Dropdowns
    const dropdowns = document.querySelectorAll('select');
    M.FormSelect.init(dropdowns);
    
    // Tabs
    const tabs = document.querySelectorAll('.tabs');
    M.Tabs.init(tabs);
    
    // Time Picker
    const timepickers = document.querySelectorAll('.timepicker');
    M.Timepicker.init(timepickers, {
        twelveHour: false,
        defaultTime: '00:00',
        autoClose: true
    });
    
    // Range Slider
    const ranges = document.querySelectorAll('input[type=range]');
    M.Range.init(ranges);
}

// Bottom Navigation Setup
function setupBottomNavigation() {
    const navCameras = document.getElementById('navCameras');
    const navSettings = document.getElementById('navSettings');
    
    navCameras.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.main-container').style.display = 'block';
        navCameras.classList.add('active');
        navSettings.classList.remove('active');
    });
    
    navSettings.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.main-container').style.display = 'none';
        navSettings.classList.add('active');
        navCameras.classList.remove('active');
        // Später: Einstellungsseite anzeigen
    });
}

// Event-Listener für Buttons einrichten
function setupEventListeners() {
    // Kamera hinzufügen Button
    const addCameraButton = document.getElementById('addCameraButton');
    addCameraButton.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Kamera hinzufügen';
        document.getElementById('cameraName').value = '';
        document.getElementById('cameraPhone').value = '';
        document.getElementById('cameraType').value = 'Standard';
        M.FormSelect.init(document.getElementById('cameraType'));
        M.updateTextFields();
        
        const modal = M.Modal.getInstance(document.getElementById('cameraModal'));
        currentCameraId = null;
        modal.open();
    });
    
    // Kamera speichern Button
    const saveCameraButton = document.getElementById('saveCameraButton');
    saveCameraButton.addEventListener('click', saveCamera);
    
    // Einstellungen senden Button
    const sendSettingsButton = document.getElementById('sendSettingsButton');
    sendSettingsButton.addEventListener('click', sendSettings);
    
    // Range Slider für Serienbilder
    const burstImagesSlider = document.getElementById('burstImages');
    if (burstImagesSlider) {
        burstImagesSlider.addEventListener('input', () => {
            document.getElementById('burstImagesValue').textContent = burstImagesSlider.value + 'P';
            updateSmsPreview();
        });
    }
    
    // Event Listener für alle Einstellungsänderungen
    const settingsInputs = document.querySelectorAll('#settingsModal input, #settingsModal select');
    settingsInputs.forEach(input => {
        input.addEventListener('change', updateSmsPreview);
    });
}

// Kamera speichern
async function saveCamera() {
    const cameraName = document.getElementById('cameraName').value.trim();
    const cameraPhone = document.getElementById('cameraPhone').value.trim();
    const cameraType = document.getElementById('cameraType').value;
    
    if (!cameraName || !cameraPhone) {
        M.toast({html: 'Bitte alle Felder ausfüllen', classes: 'toast-error'});
        return;
    }
    
    if (!isValidPhoneNumber(cameraPhone)) {
        M.toast({html: 'Bitte gültige Telefonnummer eingeben', classes: 'toast-error'});
        return;
    }
    
    try {
        // Neue Kamera oder bestehende aktualisieren
        if (currentCameraId === null) {
            // Neue Kamera
            const newCamera = {
                id: Date.now().toString(),
                name: cameraName,
                phone: cameraPhone,
                type: cameraType
            };
            
            // In Datenbank speichern
            await dbManager.saveCamera(newCamera);
            
            // Zu lokaler Liste hinzufügen
            cameras.push(newCamera);
            
            // Zur UI hinzufügen
            addCameraToUI(newCamera);
            
            M.toast({html: 'Kamera hinzugefügt', classes: 'toast-success'});
        } else {
            // Kamera aktualisieren
            const cameraIndex = cameras.findIndex(cam => cam.id === currentCameraId);
            if (cameraIndex !== -1) {
                const updatedCamera = {
                    ...cameras[cameraIndex],
                    name: cameraName,
                    phone: cameraPhone,
                    type: cameraType
                };
                
                // In Datenbank speichern
                await dbManager.saveCamera(updatedCamera);
                
                // Lokale Liste aktualisieren
                cameras[cameraIndex] = updatedCamera;
                
                // UI aktualisieren
                updateCameraInUI(updatedCamera);
                
                M.toast({html: 'Kamera aktualisiert', classes: 'toast-success'});
            }
        }
        
        // Modal schließen
        const modal = M.Modal.getInstance(document.getElementById('cameraModal'));
        modal.close();
    } catch (error) {
        console.error('Fehler beim Speichern der Kamera:', error);
        M.toast({html: 'Fehler beim Speichern der Kamera', classes: 'toast-error'});
    }
}

// Kameras aus der Datenbank laden
async function loadCameras() {
    try {
        document.getElementById('loadingIndicator').classList.remove('hide');
        
        cameras = await dbManager.getAllCameras();
        
        if (cameras.length === 0) {
            // Demo-Daten hinzufügen, falls keine Kameras vorhanden sind
            const demoCameras = [
                {
                    id: '1',
                    name: 'Werner Kamera Schütt',
                    phone: '01757164718',
                    type: 'Pro'
                },
                {
                    id: '2',
                    name: 'Hirschmüller Links',
                    phone: '00319703780580',
                    type: 'Pro'
                },
                {
                    id: '3',
                    name: 'democam',
                    phone: '01609760483',
                    type: 'Max'
                }
            ];
            
            // Demo-Kameras in Datenbank speichern
            for (const cam of demoCameras) {
                await dbManager.saveCamera(cam);
            }
            
            // Lokale Liste aktualisieren
            cameras = demoCameras;
        }
        
        // UI aktualisieren
        renderCameraList();
    } catch (error) {
        console.error('Fehler beim Laden der Kameras:', error);
        M.toast({html: 'Fehler beim Laden der Kameras', classes: 'toast-error'});
    } finally {
        document.getElementById('loadingIndicator').classList.add('hide');
    }
}

// Kameras in der UI rendern
function renderCameraList() {
    const cameraList = document.getElementById('cameraList');
    cameraList.innerHTML = '';
    
    if (cameras.length === 0) {
        cameraList.innerHTML = `
            <div class="center-align" style="padding: 30px;">
                <i class="material-icons large" style="color: #ccc;">photo_camera</i>
                <p>Keine Kameras vorhanden. Klicken Sie auf das + um eine Kamera hinzuzufügen.</p>
            </div>
        `;
        return;
    }
    
    cameras.forEach(camera => {
        addCameraToUI(camera);
    });
}

// Eine Kamera zur UI hinzufügen
function addCameraToUI(camera) {
    const cameraList = document.getElementById('cameraList');
    
    const cameraItem = document.createElement('div');
    cameraItem.className = 'camera-list-item';
    cameraItem.dataset.id = camera.id;
    
    cameraItem.innerHTML = `
        <div class="camera-list-header">
            <div class="camera-icon">
                <i class="material-icons">photo_camera</i>
            </div>
            <div class="camera-info">
                <h5 class="camera-name">${camera.name}</h5>
                <p class="camera-phone">Telefonnummer: ${camera.phone}</p>
            </div>
            <span class="camera-badge">${camera.type}</span>
        </div>
        <div class="camera-actions">
            <div class="camera-action" data-action="settings">
                <i class="material-icons action-icon">settings</i>
                <span class="camera-action-label">Einstellungen</span>
            </div>
            <div class="camera-action" data-action="rename">
                <i class="material-icons action-icon">edit</i>
                <span class="camera-action-label">Umbenennen</span>
            </div>
            <div class="camera-action" data-action="photo">
                <i class="material-icons action-icon">photo</i>
                <span class="camera-action-label">Bild anfordern</span>
            </div>
            <div class="camera-action" data-action="delete">
                <i class="material-icons action-icon">delete</i>
                <span class="camera-action-label">Löschen</span>
            </div>
        </div>
    `;
    
    cameraList.appendChild(cameraItem);
    
    // Event Listener für Kamera-Aktionen
    setupCameraActions(cameraItem, camera);
}

// Kamera in der UI aktualisieren
function updateCameraInUI(camera) {
    const cameraItem = document.querySelector(`.camera-list-item[data-id="${camera.id}"]`);
    if (cameraItem) {
        cameraItem.querySelector('.camera-name').textContent = camera.name;
        cameraItem.querySelector('.camera-phone').textContent = `Telefonnummer: ${camera.phone}`;
        cameraItem.querySelector('.camera-badge').textContent = camera.type;
    }
}

// Aktionen für eine Kamera einrichten
function setupCameraActions(cameraItem, camera) {
    const actions = cameraItem.querySelectorAll('.camera-action');
    
    actions.forEach(action => {
        action.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const actionType = action.dataset.action;
            switch (actionType) {
                case 'settings':
                    openSettingsModal(camera);
                    break;
                case 'rename':
                    openRenameModal(camera);
                    break;
                case 'photo':
                    requestPhoto(camera);
                    break;
                case 'delete':
                    confirmDeleteCamera(camera);
                    break;
            }
        });
    });
}


// Umbenennen-Modal öffnen
function openRenameModal(camera) {
    currentCameraId = camera.id;
    
    document.getElementById('modalTitle').textContent = 'Kamera umbenennen';
    document.getElementById('cameraName').value = camera.name;
    document.getElementById('cameraPhone').value = camera.phone;
    document.getElementById('cameraType').value = camera.type;
    M.FormSelect.init(document.getElementById('cameraType'));
    M.updateTextFields();
    
    const modal = M.Modal.getInstance(document.getElementById('cameraModal'));
    modal.open();
}

// Foto anfordern
async function requestPhoto(camera) {
    const smsText = buildSmsCommand('photo');
    
    try {
        const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
        
        if (sent) {
            M.toast({html: `Foto angefordert von ${camera.name}`, classes: 'toast-success'});
        } else if (!navigator.onLine) {
            M.toast({html: `Offline: Foto-Anfrage wird gesendet, sobald Sie wieder online sind`, classes: 'toast-info'});
        } else {
            M.toast({html: `Foto-Anfrage wird im Hintergrund gesendet`, classes: 'toast-info'});
        }
    } catch (error) {
        console.error('Fehler beim Senden der Foto-Anfrage:', error);
        M.toast({html: `Fehler beim Anfordern des Fotos`, classes: 'toast-error'});
    }
}

// Kamera-Löschen bestätigen
function confirmDeleteCamera(camera) {
    if (confirm(`Möchten Sie wirklich die Kamera "${camera.name}" löschen?`)) {
        deleteCamera(camera.id);
    }
}

// Kamera löschen
async function deleteCamera(cameraId) {
    try {
        // Aus der Datenbank löschen
        await dbManager.deleteCamera(cameraId);
        
        // Aus der lokalen Liste entfernen
        cameras = cameras.filter(cam => cam.id !== cameraId);
        
        // Aus der UI entfernen
        const cameraItem = document.querySelector(`.camera-list-item[data-id="${cameraId}"]`);
        if (cameraItem) {
            cameraItem.remove();
        }
        
        M.toast({html: 'Kamera gelöscht', classes: 'toast-success'});
        
        // Liste neu rendern, falls leer
        if (cameras.length === 0) {
            renderCameraList();
        }
    } catch (error) {
        console.error('Fehler beim Löschen der Kamera:', error);
        M.toast({html: 'Fehler beim Löschen der Kamera', classes: 'toast-error'});
    }
}

// Einstellungsformular mit Standardwerten initialisieren
function initializeSettingsForm() {
    // Allgemeine Einstellungen
    document.getElementById('smsControl').value = 'Täglich';
    document.getElementById('imageSize').value = 'Original';
    document.getElementById('statusTime').value = '00:00';
    document.getElementById('statusReportSwitch').checked = true;
    document.getElementById('maxCount').value = 'Kein Limit';
    document.getElementById('maxCountSwitch').checked = false;
    document.getElementById('mmsControlSwitch').checked = false;
    document.getElementById('smtpSwitch').checked = true;
    document.getElementById('ftpMode').value = 'AUS';
    
    // Kamera-Einstellungen
    document.getElementById('sendImageSwitch').checked = true;
    document.getElementById('sendVideoSwitch').checked = false;
    document.getElementById('captureMode').value = 'Bild';
    document.getElementById('nightMode').value = 'Balance';
    document.getElementById('imageResolution').value = '24M';
    document.getElementById('videoResolution').value = 'FHD-1920x1080';
    document.getElementById('pirSensitivity').value = 'Hoch';
    document.getElementById('flashLed').value = 'Hoch';
    document.getElementById('videoDuration').value = '5s';
    document.getElementById('hourSystem').value = '24h';
    document.getElementById('burstImages').value = 1;
    document.getElementById('burstImagesValue').textContent = '1P';
    document.getElementById('motionSensorSwitch').checked = true;
    document.getElementById('sdCycleSwitch').checked = true;
    
    // Timer-Einstellungen
    document.getElementById('timer1Start').value = '00:00';
    document.getElementById('timer1End').value = '00:00';
    document.getElementById('timer1Switch').checked = false;
    document.getElementById('timer2Start').value = '00:00';
    document.getElementById('timer2End').value = '00:00';
    document.getElementById('timer2Switch').checked = false;
    document.getElementById('delayTime').value = '00:00:00';
    document.getElementById('delaySwitch').checked = false;
    document.getElementById('timelapseTime').value = '00:00:00';
    document.getElementById('timelapseSwitch').checked = false;
    
    // Empfänger
    document.getElementById('phone1').value = '';
    document.getElementById('email1').value = '';
    
    // Alle Selects neu initialisieren
    M.FormSelect.init(document.querySelectorAll('select'));
    
    // Alle Textfelder aktualisieren
    M.updateTextFields();
}

// Einstellungsformular mit gespeicherten Werten füllen
function fillSettingsForm(settings) {
    // Zuerst Standardwerte setzen
    initializeSettingsForm();
    
    // Dann vorhandene Werte überschreiben
    for (const [key, value] of Object.entries(settings)) {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.tagName === 'SELECT') {
                element.value = value;
                M.FormSelect.init(element);
            } else {
                element.value = value;
            }
        }
    }
    
    // Range-Slider aktualisieren
    if (settings.burstImages) {
        document.getElementById('burstImagesValue').textContent = settings.burstImages + 'P';
    }
    
    // Alle Textfelder aktualisieren
    M.updateTextFields();
}

// Aktuelle Einstellungen aus dem Formular lesen
function getSettingsFromForm() {
    const settings = {
        // Allgemeine Einstellungen
        smsControl: document.getElementById('smsControl').value,
        imageSize: document.getElementById('imageSize').value,
        statusReportSwitch: document.getElementById('statusReportSwitch').checked,
        statusTime: document.getElementById('statusTime').value,
        maxCount: document.getElementById('maxCount').value,
        maxCountSwitch: document.getElementById('maxCountSwitch').checked,
        mmsControlSwitch: document.getElementById('mmsControlSwitch').checked,
        smtpSwitch: document.getElementById('smtpSwitch').checked,
        ftpMode: document.getElementById('ftpMode').value,
        
        // Kamera-Einstellungen
        sendImageSwitch: document.getElementById('sendImageSwitch').checked,
        sendVideoSwitch: document.getElementById('sendVideoSwitch').checked,
        captureMode: document.getElementById('captureMode').value,
        nightMode: document.getElementById('nightMode').value,
        imageResolution: document.getElementById('imageResolution').value,
        videoResolution: document.getElementById('videoResolution').value,
        pirSensitivity: document.getElementById('pirSensitivity').value,
        flashLed: document.getElementById('flashLed').value,
        videoDuration: document.getElementById('videoDuration').value,
        hourSystem: document.getElementById('hourSystem').value,
        burstImages: document.getElementById('burstImages').value,
        motionSensorSwitch: document.getElementById('motionSensorSwitch').checked,
        sdCycleSwitch: document.getElementById('sdCycleSwitch').checked,
        
        // Timer-Einstellungen
        timer1Switch: document.getElementById('timer1Switch').checked,
        timer1Start: document.getElementById('timer1Start').value,
        timer1End: document.getElementById('timer1End').value,
        timer2Switch: document.getElementById('timer2Switch').checked,
        timer2Start: document.getElementById('timer2Start').value,
        timer2End: document.getElementById('timer2End').value,
        delaySwitch: document.getElementById('delaySwitch').checked,
        delayTime: document.getElementById('delayTime').value,
        timelapseSwitch: document.getElementById('timelapseSwitch').checked,
        timelapseTime: document.getElementById('timelapseTime').value,
        
        // Empfänger
        phone1: document.getElementById('phone1').value,
        email1: document.getElementById('email1').value
    };
    
    return settings;
}


// Einstellungen senden
async function sendSettings() {
    // Aktive Kamera finden
    const camera = cameras.find(cam => cam.id === currentCameraId);
    if (!camera) return;
    
    // Aktuelle Einstellungen aus dem Formular lesen
    const settings = getSettingsFromForm();
    
    // Einstellungen in der Datenbank speichern
    try {
        await dbManager.saveSettings(camera.id, settings);
    } catch (error) {
        console.error('Fehler beim Speichern der Einstellungen:', error);
    }
    
    // Aktive Tab ermitteln
    let activeTab = '';
    const tabLinks = document.querySelectorAll('.tabs .tab a');
    tabLinks.forEach(tab => {
        if (tab.classList.contains('active')) {
            activeTab = tab.getAttribute('href').substring(1);
        }
    });
    
    let smsType = '';
    
    // Je nach aktivem Tab unterschiedliche Befehle zusammenbauen
    switch (activeTab) {
        case 'generalSettings':
            smsType = 'general';
            break;
        case 'cameraSettings':
            smsType = 'camera';
            break;
        case 'timerSettings':
            smsType = 'timer';
            break;
        default:
            smsType = 'general';
    }
    
    // SMS-Text generieren
    const smsText = buildSmsCommand(smsType);
    
    // SMS senden
    try {
        const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
        
        if (sent) {
            M.toast({html: `Einstellungen gesendet an ${camera.name}`, classes: 'toast-success'});
        } else if (!navigator.onLine) {
            M.toast({html: `Offline: Einstellungen werden gesendet, sobald Sie wieder online sind`, classes: 'toast-info'});
        } else {
            M.toast({html: `Einstellungen werden im Hintergrund gesendet`, classes: 'toast-info'});
        }
        
        // Modal schließen
        const modal = M.Modal.getInstance(document.getElementById('settingsModal'));
        modal.close();
    } catch (error) {
        console.error('Fehler beim Senden der Einstellungen:', error);
        M.toast({html: `Fehler beim Senden der Einstellungen`, classes: 'toast-error'});
    }
}

// Nach ausstehenden SMS schauen
async function checkPendingSMS() {
    try {
        const count = await smsManager.getPendingSmsCount();
        
        if (count > 0) {
            M.toast({
                html: `Es ${count === 1 ? 'gibt' : 'gibt'} ${count} ausstehende SMS. Synchronisation wird gestartet...`,
                classes: 'toast-info',
                displayLength: 4000
            });
            
            // Falls online, Synchronisation starten
            if (navigator.onLine) {
                syncPendingSMS();
            }
        }
    } catch (error) {
        console.error('Fehler beim Prüfen auf ausstehende SMS:', error);
    }
}


// Hilfsfunktion: Telefonnummer validieren
function isValidPhoneNumber(phoneNumber) {
    // Einfache Validierung: mindestens 8 Ziffern, kann mit + beginnen
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    return phoneRegex.test(phoneNumber);
}


/**
 * Notwendige Änderungen in app.js
 * 
 * Diese Änderungen müssen in die bestehende app.js-Datei integriert werden.
 */

// 1. Neue Import-Anweisungen am Anfang der Datei
// --------------------------------------------------
// Fügen Sie diese Zeilen nach den bestehenden Import-Anweisungen hinzu
// document.write('<link rel="stylesheet" href="styles-extensions.css">');
// document.write('<script src="ui-extensions.js"></script>');
// document.write('<script src="camera-settings.js"></script>');
// document.write('<script src="sync-manager.js"></script>');

// 2. Änderungen in der DOMContentLoaded-Funktion
// --------------------------------------------------
// Ersetzen Sie die bestehende Funktion durch diese erweiterte Version:

document.addEventListener('DOMContentLoaded', async () => {
  // Module holen
  const dbManager      = window.dbManager;
  const smsManager     = window.smsManager;
  const uiExtensions   = window.uiExtensions;
  const cameraSettings = window.cameraSettings;
  const syncManager    = window.syncManager;

  // Materialize-Komponenten, Navigation & Events
  initMaterializeComponents();
  setupBottomNavigation();
  setupEventListeners();

  // Kameras laden
  await loadCameras();

  // Ausstehende SMS synchronisieren und Status überwachen
  await syncManager.checkPendingSMS();
  syncManager.setupNetworkStatus();

  // Erweiterungen initialisieren
  uiExtensions.setupCameraListFiltering();
  uiExtensions.setupBatchOperations();
  uiExtensions.setupDragAndDropSorting();
  cameraSettings.setupLiveSettingsPreview();
});


// 3. Ersetzen der openSettingsModal-Funktion
// --------------------------------------------------
// Die bestehende openSettingsModal-Funktion durch die neue aus camera-settings.js ersetzen:

/**
 * Einstellungs-Modal öffnen
 * Verwenden Sie jetzt die erweiterte Version aus camera-settings.js
 */
async function openSettingsModal(camera) {
    return cameraSettings.openSettingsModal(camera);
}

// 4. Ersetzen der syncPendingSMS-Funktion
// --------------------------------------------------
// Die bestehende syncPendingSMS-Funktion durch die neue aus sync-manager.js ersetzen:

/**
 * Ausstehende SMS synchronisieren
 * Verwenden Sie jetzt die erweiterte Version aus sync-manager.js
 */
async function syncPendingSMS() {
    return syncManager.syncPendingSMS();
}

// 5. Ersetzen der updateSmsPreview-Funktion
// --------------------------------------------------
// Die bestehende updateSmsPreview-Funktion durch die neue aus camera-settings.js ersetzen:

/**
 * SMS-Vorschau aktualisieren
 * Verwenden Sie jetzt die erweiterte Version aus camera-settings.js
 */
function updateSmsPreview() {
    return cameraSettings.updateSmsPreview();
}

// 6. Ersetzen der setupNetworkStatus-Funktion
// --------------------------------------------------
// Ersetzen Sie diese Funktion durch die Version aus sync-manager.js:

/**
 * Online/Offline-Status überwachen
 * Verwenden Sie jetzt die erweiterte Version aus sync-manager.js
 */
function setupNetworkStatus() {
    return syncManager.setupNetworkStatus();
}