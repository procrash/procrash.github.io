/**
 * sms-commands.js
 * Enthält Funktionen zum Erstellen der SMS-Steuerkommandos für Wildkameras
 */

// SMS-Kommandopräfix
const SMS_PREFIX = '#WK';

/**
 * Generiert das SMS-Kommando basierend auf den ausgewählten Einstellungen
 * @param {string} commandType - Art des Kommandos (general, camera, timer, photo, video, status)
 * @returns {string} - Vollständiges SMS-Kommando
 */
function generateSmsCommand(commandType) {
    switch (commandType) {
        case 'general':
            return generateGeneralCommand();
        case 'camera':
            return generateCameraCommand();
        case 'timer':
            return generateTimerCommand();
        case 'photo':
            return `${SMS_PREFIX}#PHOTO`;
        case 'video':
            return `${SMS_PREFIX}#VIDEO`;
        case 'status':
            return `${SMS_PREFIX}#STATUS`;
        case 'reset':
            return `${SMS_PREFIX}#RESET`;
        default:
            return `${SMS_PREFIX}#STATUS`;
    }
}

/**
 * Generiert das Kommando für allgemeine Einstellungen
 * @returns {string} - SMS-Kommando für allgemeine Einstellungen
 */
function generateGeneralCommand() {
    const smsControl = document.getElementById('smsControl').value;
    const imageSize = document.getElementById('imageSize').value;
    const statusActive = document.getElementById('statusReportSwitch').checked;
    const statusTime = document.getElementById('statusTime').value || '00:00';
    const smtpActive = document.getElementById('smtpSwitch').checked;
    const ftpMode = document.getElementById('ftpMode').value;
    
    // Baue das Kommando zusammen
    let command = `${SMS_PREFIX}#SETUP`;
    
    // SMS-Fernsteuerung
    command += `;SMS=${smsControl === 'Sofort' ? 'ON' : 'DAILY'}`;
    
    // Bildgröße
    let imgSizeParam = 'OR'; // Original
    switch (imageSize) {
        case 'Klein':
            imgSizeParam = 'SM';
            break;
        case 'Größer':
            imgSizeParam = 'LA';
            break;
        case 'HD':
            imgSizeParam = 'HD';
            break;
    }
    command += `;IMG=${imgSizeParam}`;
    
    // Statusbericht
    if (statusActive) {
        command += `;SREP=${statusTime.replace(':', '')}`;
    } else {
        command += `;SREP=OFF`;
    }
    
    // SMTP
    command += `;SMTP=${smtpActive ? 'ON' : 'OFF'}`;
    
    // FTP
    if (ftpMode === 'AUS') {
        command += `;FTP=OFF`;
    } else if (ftpMode === 'FTPS') {
        command += `;FTP=FTPS`;
    } else {
        command += `;FTP=ON`;
    }
    
    // Empfänger
    const phone1 = document.getElementById('phone1').value;
    if (phone1) {
        command += `;PH1=${phone1}`;
    }
    
    const email1 = document.getElementById('email1').value;
    if (email1) {
        command += `;EMAIL1=${email1}`;
    }
    
    return command;
}

/**
 * Generiert das Kommando für Kameraeinstellungen
 * @returns {string} - SMS-Kommando für Kameraeinstellungen
 */
function generateCameraCommand() {
    const sendImage = document.getElementById('sendImageSwitch').checked;
    const sendVideo = document.getElementById('sendVideoSwitch').checked;
    const captureMode = document.getElementById('captureMode').value;
    const nightMode = document.getElementById('nightMode').value;
    const imageResolution = document.getElementById('imageResolution').value;
    const videoResolution = document.getElementById('videoResolution').value;
    const pirSensitivity = document.getElementById('pirSensitivity').value;
    const flashLed = document.getElementById('flashLed').value;
    const videoDuration = document.getElementById('videoDuration').value;
    const burstImages = document.getElementById('burstImages').value;
    const motionSensor = document.getElementById('motionSensorSwitch').checked;
    const sdCycle = document.getElementById('sdCycleSwitch').checked;
    
    // Baue das Kommando zusammen
    let command = `${SMS_PREFIX}#CAM`;
    
    // Versand Bild/Video
    command += `;SEND=${sendImage ? 'IMG' : ''}${sendVideo ? 'VID' : ''}`;
    if (!sendImage && !sendVideo) {
        command += 'OFF';
    }
    
    // Aufnahmemodus
    let modeParam = 'IMG';
    switch (captureMode) {
        case 'Video':
            modeParam = 'VID';
            break;
        case 'P+V':
        case 'Bild+Video':
            modeParam = 'BOTH';
            break;
    }
    command += `;MODE=${modeParam}`;
    
    // Nachtmodus
    let nightParam = 'BAL';
    switch (nightMode) {
        case 'Qualität':
            nightParam = 'QUAL';
            break;
        case 'Öko':
            nightParam = 'ECO';
            break;
    }
    command += `;NIGHT=${nightParam}`;
    
    // Bildauflösung
    command += `;IMRES=${imageResolution.replace('MP', '')}`;
    
    // Videoauflösung
    let vidRes = 'FHD';
    if (videoResolution.includes('1280x720')) {
        vidRes = 'HD';
    } else if (videoResolution.includes('848x480')) {
        vidRes = 'WVGA';
    }
    command += `;VIDRES=${vidRes}`;
    
    // PIR Sensibilität
    if (pirSensitivity.startsWith('L')) {
        command += `;PIR=${pirSensitivity}`;
    } else {
        let pirParam = 'HIGH';
        switch (pirSensitivity) {
            case 'Mittel':
                pirParam = 'MID';
                break;
            case 'Niedrig':
                pirParam = 'LOW';
                break;
        }
        command += `;PIR=${pirParam}`;
    }
    
    // Blitz LED
    command += `;FLASH=${flashLed === 'Hoch' ? 'HIGH' : 'LOW'}`;
    
    // Videodauer
    command += `;VLEN=${videoDuration.replace('s', '')}`;
    
    // Serienbilder
    command += `;BURST=${burstImages}`;
    
    // Bewegungssensor
    command += `;PIR=${motionSensor ? 'ON' : 'OFF'}`;
    
    // SD Zyklus
    command += `;CYCLE=${sdCycle ? 'ON' : 'OFF'}`;
    
    return command;
}

/**
 * Generiert das Kommando für Timer-Einstellungen
 * @returns {string} - SMS-Kommando für Timer-Einstellungen
 */
function generateTimerCommand() {
    const timer1Active = document.getElementById('timer1Switch').checked;
    const timer1Start = document.getElementById('timer1Start').value || '00:00';
    const timer1End = document.getElementById('timer1End').value || '00:00';
    
    const timer2Active = document.getElementById('timer2Switch').checked;
    const timer2Start = document.getElementById('timer2Start').value || '00:00';
    const timer2End = document.getElementById('timer2End').value || '00:00';
    
    const delayActive = document.getElementById('delaySwitch').checked;
    const delayTime = document.getElementById('delayTime').value || '00:00:00';
    
    const timelapseActive = document.getElementById('timelapseSwitch').checked;
    const timelapseTime = document.getElementById('timelapseTime').value || '00:00:00';
    
    // Baue das Kommando zusammen
    let command = `${SMS_PREFIX}#TIMER`;
    
    // Timer 1
    if (timer1Active) {
        const t1Start = timer1Start.replace(':', '');
        const t1End = timer1End.replace(':', '');
        command += `;T1=${t1Start}-${t1End}`;
    } else {
        command += ';T1=OFF';
    }
    
    // Timer 2
    if (timer2Active) {
        const t2Start = timer2Start.replace(':', '');
        const t2End = timer2End.replace(':', '');
        command += `;T2=${t2Start}-${t2End}`;
    } else {
        command += ';T2=OFF';
    }
    
    // Verzögerung
    if (delayActive) {
        // Format 00:00:00 in Sekunden umwandeln
        const delayParts = delayTime.split(':');
        let delaySecs = 0;
        if (delayParts.length === 3) {
            delaySecs = parseInt(delayParts[0]) * 3600 + parseInt(delayParts[1]) * 60 + parseInt(delayParts[2]);
        }
        command += `;DELAY=${delaySecs}`;
    }
    
    // Zeitraffer
    if (timelapseActive) {
        // Format 00:00:00 in Sekunden umwandeln
        const timelapseParts = timelapseTime.split(':');
        let timelapseSecs = 0;
        if (timelapseParts.length === 3) {
            timelapseSecs = parseInt(timelapseParts[0]) * 3600 + parseInt(timelapseParts[1]) * 60 + parseInt(timelapseParts[2]);
        }
        command += `;TLAPSE=${timelapseSecs}`;
    }
    
    return command;
}

/**
 * Generiert spezielle Schnellbefehle für Wildkameras
 * @param {string} commandType - Art des Schnellbefehls
 * @returns {string} - SMS-Kommando
 */
function generateQuickCommand(commandType) {
    switch (commandType) {
        case 'photo':
            return `${SMS_PREFIX}#PHOTO`;
        case 'video':
            return `${SMS_PREFIX}#VIDEO10`; // 10 Sekunden Video
        case 'status':
            return `${SMS_PREFIX}#STATUS`;
        case 'battery':
            return `${SMS_PREFIX}#BATTERY`;
        case 'memory':
            return `${SMS_PREFIX}#MEMORY`;
        case 'location':
            return `${SMS_PREFIX}#LOCATE`;
        case 'power_on':
            return `${SMS_PREFIX}#POWER=ON`;
        case 'power_off':
            return `${SMS_PREFIX}#POWER=OFF`;
        case 'reset':
            return `${SMS_PREFIX}#RESET`;
        default:
            return `${SMS_PREFIX}#STATUS`;
    }
}

/**
 * Baut das SMS-Kommando basierend auf den Formularfeldern zusammen
 * @param {string} type - Art des Kommandos
 * @returns {string} - Vollständiges SMS-Kommando
 */
function buildSmsCommand(type) {
    if (['photo', 'video', 'status', 'battery', 'memory', 'location', 'power_on', 'power_off', 'reset'].includes(type)) {
        return generateQuickCommand(type);
    } else {
        return generateSmsCommand(type);
    }
}

// Exportiere die Funktion, um sie in app.js zu nutzen
window.buildSmsCommand = buildSmsCommand;
