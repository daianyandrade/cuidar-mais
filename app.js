import { DEMO_STORAGE_KEY, acknowledgeReminderUnderstanding, addAppointment, addFamilyContact, addMedication, addSimulationCallEvent, addSimulationCallRecord, calculateSchedule, createDemoState, getMedication, getNextScheduledReminder, getReminderCount, updateMedication, updateReferenceUbs } from './demo-state.js';
import { createMenuReading, createVoiceResponse, identifyVoiceCommand } from './voice-assistant.js';

const fontToggle = document.querySelector('[data-font-toggle]');
const toast = document.querySelector('.toast');
const installButton = document.querySelector('#install-app');
const voiceMenuButton = document.querySelector('#voice-menu-toggle');
const homeVoiceMenuButton = document.querySelector('#home-voice-menu');
const voiceMenuStatus = document.querySelector('#voice-menu-status');
const homeView = document.querySelector('#home-view');
const medicationsView = document.querySelector('#medications-view');
const finderView = document.querySelector('#finder-view');
const consultationsView = document.querySelector('#consultations-view');
const familyView = document.querySelector('#family-view');
const openUbsFinderButton = document.querySelector('#open-ubs-finder');
const welcome = document.querySelector('.welcome');
const medicationForm = document.querySelector('#medication-form');
const scheduleFields = document.querySelector('#schedule-fields');
const formMessage = document.querySelector('#form-message');
const frequencyInput = document.querySelector('#medication-frequency');
const intervalInput = document.querySelector('#medication-interval');
const customFrequencyField = document.querySelector('#custom-frequency-field');
const customFrequencyInput = document.querySelector('#custom-frequency');
const customIntervalField = document.querySelector('#custom-interval-field');
const customIntervalInput = document.querySelector('#custom-interval');
const firstTimeInput = document.querySelector('#first-time');
const calculatedSchedule = document.querySelector('#calculated-schedule');
const cancelEditButton = document.querySelector('#cancel-edit');
const appointmentForm = document.querySelector('#appointment-form');
const appointmentFormMessage = document.querySelector('#appointment-form-message');
const familyContactForm = document.querySelector('#family-contact-form');
const familyContactMessage = document.querySelector('#family-contact-message');
const ubsForm = document.querySelector('#ubs-form');
const ubsFormMessage = document.querySelector('#ubs-form-message');
const voiceAssistantResponse = document.querySelector('#voice-assistant-response');
const voiceAssistantMessage = document.querySelector('#voice-assistant-message');
const voiceAssistantRepeatButton = document.querySelector('#voice-assistant-repeat');
const voiceAssistantRetryButton = document.querySelector('#voice-assistant-retry');
const voiceAssistantConfirmCallButton = document.querySelector('#voice-assistant-confirm-call');
const voiceAssistantCancelCallButton = document.querySelector('#voice-assistant-cancel-call');
const callSimulation = document.querySelector('#call-simulation');
const callSimulationMessage = document.querySelector('#call-simulation-message');
const callSimulationRecipient = document.querySelector('#call-simulation-recipient');
const callListeningStatus = document.querySelector('#call-listening-status');
const answerSimulatedCallButton = document.querySelector('#answer-simulated-call');
const finderSearchButton = document.querySelector('#finder-search');
const finderStatus = document.querySelector('#finder-status');
const finderResults = document.querySelector('#finder-results');
const finderMapRegion = document.querySelector('#finder-map-region');
let activeCallKind = null;
let activeCallAppointmentId = null;
let activeCallReminder = null;
let voiceRecognition = null;
let menuVoiceRecognition = null;
let assistantVoiceRecognition = null;
let assistantRecognitionAttempts = 0;
let pendingAssistantAction = null;
let lastAssistantResponse = '';
let recognitionAttempts = 0;
let callAnswered = false;
let toastTimer;
let deferredInstallPrompt;
let state = loadState();
let calculatedTimes = [];
let editingMedicationId = null;
let finderUnits = [];
let finderLocation = null;
let finderMap = null;
let finderMarkers = new Map();
let finderPayload = null;
const FINDER_RADIUS_KM = 10;
const MAX_QUESTION_REPETITIONS = 1;
const demonstrationServices = [
  { specialty: 'geriatria', type: 'SUS', name: 'Atendimento em geriatria — exemplo', description: 'Exemplo de local que pode oferecer cuidado à pessoa idosa. Confirme a necessidade de encaminhamento e a disponibilidade.' },
  { specialty: 'exames', type: 'Particular', name: 'Laboratório — exemplo', description: 'Exemplo de local para realização de exames. Confirme preparo, valores e disponibilidade diretamente com a unidade.' },
  { specialty: 'clinica', type: 'SUS', name: 'Clínica geral — exemplo', description: 'Exemplo de porta de entrada para atendimento. Não representa agendamento ou disponibilidade de consulta.' }
];

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButton() {
  installButton.hidden = !deferredInstallPrompt || isStandalone();
}

function loadState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY));
    if (savedState?.medications && savedState?.reminder && savedState?.history) {
      const defaults = createDemoState();
      return {
        ...defaults,
        ...savedState,
        appointments: Array.isArray(savedState.appointments) ? savedState.appointments : defaults.appointments,
        familyContacts: Array.isArray(savedState.familyContacts) ? savedState.familyContacts : defaults.familyContacts,
        ubs: savedState.ubs && typeof savedState.ubs === 'object' ? savedState.ubs : defaults.ubs,
        callHistory: Array.isArray(savedState.callHistory) ? savedState.callHistory : defaults.callHistory,
        reminderAcknowledgements: Array.isArray(savedState.reminderAcknowledgements) ? savedState.reminderAcknowledgements : defaults.reminderAcknowledgements
      };
    }
  } catch {
    // Um dado local inválido não impede o modo demonstração de abrir.
  }
  return createDemoState();
}

function saveState() { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); }
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4600);
}
function showFutureMessage(action) { showToast(`${action}. Esta área será incluída nas próximas etapas da demonstração.`); }
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}
function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function setVoiceMenuStatus(message = '', hidden = !message) {
  voiceMenuStatus.textContent = message;
  voiceMenuStatus.hidden = hidden;
}

function finishMenuVoiceRecognition() {
  menuVoiceRecognition = null;
  voiceMenuButton.classList.remove('listening');
  voiceMenuButton.setAttribute('aria-pressed', 'false');
  voiceMenuButton.setAttribute('aria-label', 'Usar comando de voz no menu');
}

function stopMenuVoiceRecognition(message = '') {
  if (menuVoiceRecognition) {
    const recognition = menuVoiceRecognition;
    menuVoiceRecognition = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch { /* A escuta já pode ter terminado. */ }
  }
  finishMenuVoiceRecognition();
  if (message) setVoiceMenuStatus(message, false);
}

function menuDestinationFor(transcript) {
  const command = String(transcript).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,!?]/g, '').trim();
  if (/\b(ligar|chamar)\b.*\b(bombeiro|bombeiros)\b/.test(command)) return 'emergency-dial';
  if (/\b(encontrar|buscar)\b.*\b(medicamento|medicamentos|remedio|remedios)\b/.test(command) || /\b(unidade|unidades)\b/.test(command)) return 'finder';
  if (/\b(medicamento|medicamentos|remedio|remedios)\b/.test(command)) return 'medications';
  if (/\b(consulta|consultas|agenda|exame|exames)\b/.test(command)) return 'consultations';
  if (/\b(familia|familiar|familiares)\b/.test(command)) return 'family';
  if (/\b(inicio|casa|principal)\b/.test(command)) return 'home';
  return null;
}

function openEmergencyDialer() {
  window.location.href = 'tel:193';
}

function openVoiceMenuDestination(destination) {
  const labels = { home: 'Início', medications: 'Medicamentos', finder: 'Encontrar medicamentos', consultations: 'Consultas', family: 'Família' };
  if (destination === 'emergency-dial') {
    setVoiceMenuStatus('Abrindo o discador para o Corpo de Bombeiros, 193.', false);
    openEmergencyDialer();
    return;
  }
  if (destination === 'finder') {
    showView('finder');
    finderSearchButton.focus({ preventScroll: true });
  } else {
    showView(destination);
  }
  setVoiceMenuStatus(`Abrindo ${labels[destination]}.`, false);
}

function startMenuVoiceRecognition() {
  if (!callSimulation.hidden) {
    setVoiceMenuStatus('Encerre a ligação simulada antes de usar o menu por voz.', false);
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setVoiceMenuStatus('Comando de voz não disponível. Use os botões do menu.', false);
    return;
  }
  const recognition = new Recognition();
  menuVoiceRecognition = recognition;
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voiceMenuButton.classList.add('listening');
  voiceMenuButton.setAttribute('aria-pressed', 'true');
  voiceMenuButton.setAttribute('aria-label', 'Parar comando de voz no menu');
  setVoiceMenuStatus('Ouvindo: diga “Início”, “Medicamentos”, “Consultas”, “Família”, “Encontrar medicamentos” ou “Ligar para os Bombeiros”.', false);
  let settled = false;
  recognition.onresult = (event) => {
    settled = true;
    const destination = menuDestinationFor(event.results?.[0]?.[0]?.transcript || '');
    finishMenuVoiceRecognition();
    if (destination) openVoiceMenuDestination(destination);
    else setVoiceMenuStatus('Não entendi. Diga “Início”, “Medicamentos”, “Consultas”, “Família”, “Encontrar medicamentos” ou “Ligar para os Bombeiros”.', false);
  };
  recognition.onerror = (event) => {
    if (settled) return;
    settled = true;
    finishMenuVoiceRecognition();
    const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microfone não autorizado. Use os botões do menu.'
      : 'Não foi possível ouvir. Toque no microfone para tentar novamente.';
    setVoiceMenuStatus(message, false);
  };
  recognition.onend = () => {
    if (!settled && menuVoiceRecognition === recognition) {
      finishMenuVoiceRecognition();
      setVoiceMenuStatus('Não foi possível ouvir. Toque no microfone para tentar novamente.', false);
    }
  };
  try {
    recognition.start();
  } catch {
    finishMenuVoiceRecognition();
    setVoiceMenuStatus('Comando de voz não disponível. Use os botões do menu.', false);
  }
}

function setAssistantListening(isListening) {
  voiceMenuButton.classList.toggle('listening', isListening);
  voiceMenuButton.setAttribute('aria-pressed', String(isListening));
  homeVoiceMenuButton.setAttribute('aria-pressed', String(isListening));
  homeVoiceMenuButton.setAttribute('aria-label', isListening ? 'Parar assistente de voz' : 'Falar com o Cuidar+ por voz');
}

function stopAssistantVoiceRecognition() {
  if (assistantVoiceRecognition) {
    const recognition = assistantVoiceRecognition;
    assistantVoiceRecognition = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch { /* A escuta já pode ter terminado. */ }
  }
  setAssistantListening(false);
}

function showAssistantResponse(answer) {
  lastAssistantResponse = answer.text;
  voiceAssistantMessage.textContent = answer.text;
  voiceAssistantResponse.hidden = false;
  voiceAssistantConfirmCallButton.hidden = !answer.requiresCallConfirmation;
  voiceAssistantCancelCallButton.hidden = !answer.requiresCallConfirmation;
}

function speakAssistantResponse(answer, { listenAfter = false } = {}) {
  showAssistantResponse(answer);
  if (!('speechSynthesis' in window)) {
    setVoiceMenuStatus('A resposta está na tela. A leitura em voz não está disponível neste navegador.', false);
    return;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(answer.text);
  speech.lang = 'pt-BR';
  speech.rate = 0.92;
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    if (listenAfter) startAssistantVoiceRecognition({ confirmationOnly: true });
  };
  speech.onend = finish;
  speech.onerror = finish;
  window.speechSynthesis.speak(speech);
}

function ubsPhoneHref() {
  const phone = state.ubs?.phone || '';
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function confirmAssistantUbsCall() {
  const href = ubsPhoneHref();
  if (!href) {
    pendingAssistantAction = null;
    speakAssistantResponse({ text: 'Não há telefone cadastrado para a sua UBS. Por segurança, não vou abrir o discador.' });
    return;
  }
  pendingAssistantAction = null;
  stopAssistantVoiceRecognition();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  voiceAssistantConfirmCallButton.hidden = true;
  voiceAssistantCancelCallButton.hidden = true;
  setVoiceMenuStatus('Abrindo o discador para a sua UBS.', false);
  window.location.href = href;
}

function handleAssistantTranscript(transcript, { confirmationOnly = false } = {}) {
  const intent = identifyVoiceCommand(transcript);
  if (pendingAssistantAction === 'ubs-call') {
    if (intent === 'confirm-call') {
      confirmAssistantUbsCall();
      return;
    }
    if (intent === 'cancel-call') {
      pendingAssistantAction = null;
      speakAssistantResponse({ text: 'Ligação cancelada.' });
      return;
    }
    const answer = { text: 'Não entendi. Diga confirmar ligação ou toque em Cancelar.', requiresCallConfirmation: true };
    speakAssistantResponse(answer);
    return;
  }
  if (confirmationOnly) return;
  const answer = createVoiceResponse(state, intent, { now: new Date(), nextReminder: getUpcomingReminder() });
  if (answer.dialEmergency) {
    pendingAssistantAction = null;
    showAssistantResponse(answer);
    setVoiceMenuStatus(answer.text, false);
    openEmergencyDialer();
    return;
  }
  pendingAssistantAction = answer.requiresCallConfirmation ? 'ubs-call' : null;
  speakAssistantResponse(answer, { listenAfter: answer.requiresCallConfirmation });
}

function startAssistantVoiceRecognition({ confirmationOnly = false } = {}) {
  if (!callSimulation.hidden) {
    setVoiceMenuStatus('Encerre a ligação simulada antes de usar o assistente de voz.', false);
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    const answer = { text: 'O reconhecimento de voz não está disponível neste navegador. Use os botões Ouvir para escutar as informações.' };
    showAssistantResponse(answer);
    setVoiceMenuStatus(answer.text, false);
    return;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  stopAssistantVoiceRecognition();
  const recognition = new Recognition();
  assistantVoiceRecognition = recognition;
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let settled = false;
  setAssistantListening(true);
  setVoiceMenuStatus(confirmationOnly ? 'Ouvindo a confirmação da ligação…' : 'Ouvindo… pergunte sobre medicamentos, agenda, UBS ou família.', false);
  recognition.onresult = (event) => {
    settled = true;
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    assistantVoiceRecognition = null;
    setAssistantListening(false);
    setVoiceMenuStatus('', true);
    handleAssistantTranscript(transcript, { confirmationOnly });
  };
  recognition.onerror = (event) => {
    if (settled) return;
    settled = true;
    assistantVoiceRecognition = null;
    setAssistantListening(false);
    const answer = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? { text: 'O microfone não foi autorizado. Use os botões Ouvir ou tente novamente.' }
      : { text: 'Não foi possível ouvir. Toque em Falar novamente para tentar.' };
    showAssistantResponse(answer);
    setVoiceMenuStatus(answer.text, false);
  };
  recognition.onend = () => {
    if (!settled && assistantVoiceRecognition === recognition) {
      assistantVoiceRecognition = null;
      setAssistantListening(false);
      const answer = { text: 'Não foi possível ouvir. Toque em Falar novamente para tentar.' };
      showAssistantResponse(answer);
      setVoiceMenuStatus(answer.text, false);
    }
  };
  try {
    recognition.start();
  } catch {
    assistantVoiceRecognition = null;
    setAssistantListening(false);
    const answer = { text: 'O reconhecimento de voz não está disponível agora. Use os botões Ouvir.' };
    showAssistantResponse(answer);
    setVoiceMenuStatus(answer.text, false);
  }
}

function readAssistantSection(section) {
  stopAssistantVoiceRecognition();
  const answer = createMenuReading(state, section, { now: new Date(), nextReminder: getUpcomingReminder() });
  pendingAssistantAction = null;
  speakAssistantResponse(answer);
}

function getActualInterval() {
  return intervalInput.value === 'custom' ? customIntervalInput.value : intervalInput.value;
}

function getStoredFrequency() {
  return frequencyInput.value === 'custom' ? `custom:${customFrequencyInput.value}` : frequencyInput.value;
}

function getStoredInterval() {
  return intervalInput.value === 'custom' ? `custom:${customIntervalInput.value}` : intervalInput.value;
}

function frequencyLabel(value) {
  if (!value) return '';
  if (value.startsWith('custom:')) return `Frequência informada: ${value.replace('custom:', '')} vezes ao dia.`;
  return `Frequência informada: ${value} ${value === '1' ? 'vez' : 'vezes'} ao dia.`;
}

function intervalLabel(value) {
  if (!value) return '';
  const hours = value.replace('custom:', '');
  return `Intervalo informado: a cada ${hours} ${hours === '1' ? 'hora' : 'horas'}.`;
}

function syncProgrammingFields() {
  customFrequencyField.hidden = frequencyInput.value !== 'custom';
  customIntervalField.hidden = intervalInput.value !== 'custom';
}

function setScheduleFields(times = ['']) {
  scheduleFields.innerHTML = '';
  times.forEach((time, index) => {
    const label = document.createElement('label');
    label.textContent = `Horário ${index + 1}`;
    const input = document.createElement('input');
    input.name = 'times';
    input.type = 'time';
    input.required = !scheduleFields.closest('[hidden]');
    input.value = time;
    label.append(input);
    scheduleFields.append(label);
  });
}

function showCalculatedSchedule(times, interval) {
  const frequency = frequencyInput.value;
  const frequencyNote = frequency && frequency !== 'custom' && Number(frequency) !== times.length
    ? `<small>A frequência informada não alterou estes horários: a programação foi calculada apenas pelo intervalo informado na receita.</small>` : '';
  const nextTime = times[1] || times[0];
  const [hours, minutes] = nextTime.split(':').map(Number);
  const reminderMinutes = (hours * 60 + minutes - 5 + 1440) % 1440;
  const reminderTime = `${String(Math.floor(reminderMinutes / 60)).padStart(2, '0')}:${String(reminderMinutes % 60).padStart(2, '0')}`;
  calculatedSchedule.innerHTML = `<strong>Horários calculados</strong><span>${times.join(' · ')}</span><small>Próximo lembrete: ${reminderTime}, cinco minutos antes do horário previsto de ${nextTime}.</small>${frequencyNote}`;
  calculatedSchedule.hidden = false;
}

function currentTimeForSchedule() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function selectedFirstDoseStatus() {
  return medicationForm.querySelector('input[name="firstDoseStatus"]:checked')?.value || 'now';
}

function syncFirstDoseSchedule() {
  if (selectedFirstDoseStatus() === 'not-taken') {
    firstTimeInput.value = '';
    calculatedTimes = [];
    setScheduleFields([]);
    calculatedSchedule.innerHTML = '<strong>Programação aguardando</strong><small>Quando a primeira dose for informada como tomada, os próximos horários poderão ser calculados conforme a receita.</small>';
    calculatedSchedule.hidden = false;
    return;
  }
  firstTimeInput.value = currentTimeForSchedule();
  calculateCurrentSchedule(false);
}

function calculateCurrentSchedule(showError = true) {
  const interval = getActualInterval();
  if (!firstTimeInput.value || !interval) {
    if (showError) {
      calculatedSchedule.textContent = 'Informe o primeiro horário e o intervalo conforme a receita para calcular a programação.';
      calculatedSchedule.hidden = false;
    }
    return [];
  }
  try {
    const times = calculateSchedule(firstTimeInput.value, interval);
    const selectedFrequency = frequencyInput.value;
    if (selectedFrequency && selectedFrequency !== 'custom' && Number(selectedFrequency) !== times.length) {
      throw new Error(`A frequência informada (${selectedFrequency} vezes ao dia) não corresponde ao intervalo de ${interval} horas. Confira a receita antes de continuar.`);
    }
    calculatedTimes = times;
    setScheduleFields(times);
    showCalculatedSchedule(times, interval);
    return times;
  } catch (error) {
    if (showError) {
      calculatedSchedule.textContent = error.message;
      calculatedSchedule.hidden = false;
    }
    return [];
  }
}

function currentLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function reminderDayLabel(reminder) {
  if (!reminder) return '';
  const today = currentLocalDateKey();
  const tomorrow = currentLocalDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
  return reminder.date === today ? 'hoje' : reminder.date === tomorrow ? 'amanhã' : 'em breve';
}

function getUpcomingReminder() {
  return getNextScheduledReminder(state, new Date());
}

function renderHome() {
  const reminder = getUpcomingReminder();
  const medication = reminder ? getMedication(state, reminder.medicationId) : null;
  const medicineTitle = document.querySelector('#medicine-title');
  const medicineKicker = document.querySelector('#home-view .medicine-card .card-kicker');
  medicineTitle.textContent = medication ? medication.name : 'Sem lembretes';
  medicineKicker.textContent = 'Próximo medicamento';
  document.querySelector('#home-reminder-details').innerHTML = medication
    ? `<span class="summary-dose">${escapeHtml(medication.dosage)}</span><strong>Hoje, às ${escapeHtml(reminder.time)}</strong>`
    : 'Não há outro lembrete programado para agora.';
  document.querySelector('.focus-label').innerHTML = `<span aria-hidden="true">●</span> Próximo lembrete${reminder ? ` · ${reminderDayLabel(reminder)}` : ''}`;
  const appointment = [...(state.appointments ?? [])]
    .filter((item) => appointmentIsFuture(item))
    .sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`))[0];
  const appointmentTitle = document.querySelector('#home-appointment-title');
  const appointmentDetails = document.querySelector('#home-appointment-details');
  if (appointment) {
    const calendar = formatAppointmentDate(appointment.date);
    appointmentTitle.textContent = appointment.title
      .replace(/^Consulta\s+com\s+/i, '')
      .replace(/^Exame\s+de\s+/i, '');
    appointmentDetails.textContent = `${calendar.day} ${calendar.month} · ${appointment.time}`;
  } else {
    appointmentTitle.textContent = 'Sem consulta marcada';
    appointmentDetails.textContent = 'Organize sua agenda';
  }
  const total = getReminderCount(state);
  document.querySelector('#daily-summary').innerHTML = `<strong>Hoje:</strong> ${total} ${total === 1 ? 'lembrete programado' : 'lembretes programados'}.`;
  const status = document.querySelector('#home-reminder-status');
  status.textContent = reminder ? 'Próximo lembrete conforme o horário deste aparelho' : 'Sem próximos lembretes';
  status.className = `reminder-status ${reminder ? 'pending' : 'confirmed'}`;
  const confirmButton = document.querySelector('#confirm-reminder');
  confirmButton.disabled = !reminder;
  confirmButton.textContent = reminder ? 'Confirmar recebimento' : 'Sem lembretes';
}

function renderMedicationList() {
  const list = document.querySelector('#medication-list');
  const count = state.medications.length;
  document.querySelector('#medication-count').textContent = `${count} ${count === 1 ? 'cadastrado' : 'cadastrados'}`;
  if (!count) { list.innerHTML = '<p class="empty-state">Nenhum medicamento demonstrativo cadastrado.</p>'; return; }
  list.innerHTML = state.medications.map((medication) => {
    const period = medication.startDate || medication.endDate
      ? `Período informado: ${medication.startDate || 'não informado'} a ${medication.endDate || 'não informado'}.` : '';
    const programming = [frequencyLabel(medication.frequency || ''), intervalLabel(medication.intervalHours || '')].filter(Boolean).join(' ');
    return `<article class="medication-item"><span class="medication-item-icon" aria-hidden="true"><img class="list-capsule-image" src="/icons/capsule-realistic.png" alt="" /></span><div>
      <strong>${escapeHtml(medication.name)} · ${escapeHtml(medication.dosage)}</strong>
      <p>${medication.firstDoseStatus === 'not-taken' ? 'Aguardando informação da primeira dose para programar os lembretes.' : `Horários de lembrete: ${medication.times.map(escapeHtml).join(', ')}.`}</p>
      ${period ? `<p>${escapeHtml(period)}</p>` : ''}
      ${programming ? `<p class="programming-details">${escapeHtml(programming)}</p>` : ''}
      ${medication.notes ? `<p class="notes">${escapeHtml(medication.notes)}</p>` : ''}
      <div class="medication-item-actions">
        <button class="medication-list-action find-medication" type="button" data-find-medication="${escapeHtml(medication.name)}">Encontrar unidades</button>
        <button class="medication-list-action edit-medication" type="button" data-edit-medication="${escapeHtml(medication.id)}">Editar programação</button>
      </div>
    </div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit-medication]').forEach((button) => {
    button.addEventListener('click', () => startEditingMedication(button.dataset.editMedication));
  });
  list.querySelectorAll('[data-find-medication]').forEach((button) => {
    button.addEventListener('click', () => focusMedicineFinder(button.dataset.findMedication));
  });
}

function focusMedicineFinder() {
  showView('finder');
  finderSearchButton.focus({ preventScroll: true });
  showToast('Encontre unidades em até 10 km e confirme o estoque no portal oficial.');
}

function formatFinderDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function getFinderDistance(unit) {
  if (!finderLocation || !unit.coordinates) return null;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDifference = toRadians(unit.coordinates.latitude - finderLocation.latitude);
  const longitudeDifference = toRadians(unit.coordinates.longitude - finderLocation.longitude);
  const startLatitude = toRadians(finderLocation.latitude);
  const endLatitude = toRadians(unit.coordinates.latitude);
  const arc = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function formatFinderDistance(distance) {
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1).replace('.', ',')} km`;
}

function finderUnitsForDisplay() {
  const units = finderUnits.map((unit) => ({ ...unit, distance: getFinderDistance(unit) }));
  const visibleUnits = finderLocation
    ? units.filter((unit) => unit.distance !== null && unit.distance <= FINDER_RADIUS_KM)
    : units;
  return visibleUnits.sort((left, right) => finderLocation
    ? left.distance - right.distance
    : left.name.localeCompare(right.name, 'pt-BR'));
}

function finderDirectionsUrl(unit) {
  if (!unit.coordinates) return '';
  const destination = `${unit.coordinates.latitude},${unit.coordinates.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function focusFinderUnit(unit) {
  const marker = finderMarkers.get(unit.id);
  if (!finderMap || !marker || !unit.coordinates) return;
  finderMap.setView([unit.coordinates.latitude, unit.coordinates.longitude], Math.max(finderMap.getZoom(), 15), { animate: true });
  marker.openPopup();
  finderMapRegion.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderFinderMap(units) {
  const mappableUnits = units.filter((unit) => unit.coordinates);
  finderMarkers = new Map();
  if (!mappableUnits.length || !window.L) {
    finderMapRegion.hidden = true;
    return;
  }

  finderMapRegion.hidden = false;
  if (!finderMap) {
    finderMap = window.L.map('finder-map', { scrollWheelZoom: false });
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(finderMap);
  } else {
    finderMap.eachLayer((layer) => {
      if (layer instanceof window.L.Marker || layer instanceof window.L.CircleMarker) finderMap.removeLayer(layer);
    });
  }

  const bounds = [];
  mappableUnits.forEach((unit) => {
    const coordinates = [unit.coordinates.latitude, unit.coordinates.longitude];
    const marker = window.L.circleMarker(coordinates, {
      radius: 9,
      color: unit.typeCode === '2' ? '#087d2e' : '#0d5f97',
      fillColor: unit.typeCode === '2' ? '#19a24a' : '#1987c9',
      fillOpacity: 1,
      weight: 2
    }).addTo(finderMap);
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = unit.name;
    const address = document.createElement('p');
    address.textContent = unit.address;
    popup.append(title, address);
    marker.bindPopup(popup);
    marker.on('click', () => document.querySelector(`[data-finder-card="${unit.id}"]`)?.focus({ preventScroll: true }));
    finderMarkers.set(unit.id, marker);
    bounds.push(coordinates);
  });

  if (finderLocation) {
    const locationCoordinates = [finderLocation.latitude, finderLocation.longitude];
    window.L.circleMarker(locationCoordinates, {
      radius: 8, color: '#5b2b8f', fillColor: '#7b3fb2', fillOpacity: 1, weight: 2
    }).addTo(finderMap).bindPopup('Sua localização aproximada');
    bounds.push(locationCoordinates);
  }

  finderMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  window.setTimeout(() => finderMap.invalidateSize(), 0);
}

function renderFinderResults(payload) {
  const units = finderUnitsForDisplay();
  finderResults.replaceChildren();
  const count = document.createElement('p');
  count.className = 'finder-result-count';
  count.textContent = finderLocation
    ? `${units.length} ${units.length === 1 ? 'unidade encontrada' : 'unidades encontradas'} em até ${FINDER_RADIUS_KM} km da sua localização.`
    : `${units.length} ${units.length === 1 ? 'unidade encontrada' : 'unidades encontradas'} no cadastro oficial.`;
  finderResults.append(count);

  const list = document.createElement('div');
  list.className = 'finder-results-list';
  units.forEach((unit) => {
    const card = document.createElement('article');
    card.className = 'finder-result-card';
    card.tabIndex = -1;
    card.dataset.finderCard = unit.id;
    const type = document.createElement('p');
    type.className = 'finder-unit-type';
    type.textContent = unit.type;
    const name = document.createElement('h4');
    name.textContent = unit.name;
    const address = document.createElement('p');
    address.className = 'finder-address';
    address.textContent = unit.address || 'Endereço não informado no cadastro oficial.';
    const details = document.createElement('p');
    details.className = 'finder-details';
    const distance = unit.distance === null || unit.distance === undefined ? '' : ` · ${formatFinderDistance(unit.distance)} de você`;
    details.textContent = `Cadastro atualizado em ${formatFinderDate(unit.updatedAt)}${distance}`;
    const actions = document.createElement('div');
    actions.className = 'finder-card-actions';
    if (unit.phone) {
      const call = document.createElement('a');
      call.href = `tel:${unit.phone.replace(/[^\d+]/g, '')}`;
      call.textContent = 'Ligar';
      actions.append(call);
    }
    if (unit.coordinates) {
      const onMap = document.createElement('button');
      onMap.type = 'button';
      onMap.textContent = 'Ver no mapa';
      onMap.addEventListener('click', () => focusFinderUnit(unit));
      actions.append(onMap);
      const directions = document.createElement('a');
      directions.href = finderDirectionsUrl(unit);
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      directions.textContent = 'Como chegar';
      actions.append(directions);
    }
    card.append(type, name, address, details);
    if (actions.childElementCount) card.append(actions);
    list.append(card);
  });
  finderResults.append(list);
  const source = document.createElement('p');
  source.className = 'finder-source';
  source.textContent = `Fonte: ${payload.sources?.[0]?.name || 'CNES'} · consulta atualizada em ${formatDateTime(payload.fetchedAt)}.`;
  finderResults.append(source);
  renderFinderMap(units);
}

async function loadFinderUnits({ fallbackMessage = '' } = {}) {
  finderSearchButton.disabled = true;
  finderStatus.textContent = 'Buscando unidades públicas cadastradas em Cuiabá…';
  try {
    const response = await fetch('/api/cuiaba-units', { headers: { accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.units)) throw new Error(payload.error || 'Falha ao buscar unidades.');
    finderUnits = payload.units;
    finderPayload = payload;
    renderFinderResults(finderPayload);
    const nearbyCount = finderUnitsForDisplay().length;
    finderStatus.textContent = finderLocation
      ? nearbyCount
        ? `Mostrando unidades do cadastro oficial em até ${FINDER_RADIUS_KM} km.`
        : `Não encontramos unidades cadastradas em até ${FINDER_RADIUS_KM} km. Esta busca cobre Cuiabá.`
      : fallbackMessage || 'Lista de unidades públicas de Cuiabá carregada.';
  } catch (error) {
    finderResults.replaceChildren();
    finderMapRegion.hidden = true;
    finderStatus.textContent = error instanceof Error ? `${error.message} Tente novamente em alguns minutos.` : 'Não foi possível carregar a lista agora. Tente novamente em alguns minutos.';
  } finally {
    finderSearchButton.disabled = false;
  }
}

function findNearbyUnits() {
  if (!navigator.geolocation) {
    finderLocation = null;
    loadFinderUnits({ fallbackMessage: 'Este aparelho não oferece localização. Mostramos a lista geral de Cuiabá.' });
    return;
  }
  finderSearchButton.disabled = true;
  finderStatus.textContent = 'Aguardando sua permissão de localização…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      finderLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      loadFinderUnits();
    },
    () => {
      finderLocation = null;
      loadFinderUnits({ fallbackMessage: 'Localização não autorizada. Mostramos a lista geral de Cuiabá.' });
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function renderHistory() {
  const history = document.querySelector('#reminder-history');
  if (!state.history.length) {
    history.innerHTML = '<p class="empty-state">Ainda não há confirmações demonstrativas. Use “Confirmar recebimento” na tela inicial.</p>';
    return;
  }
  history.innerHTML = state.history.map((entry) => {
    const medication = getMedication(state, entry.medicationId);
    return `<article class="history-item"><strong>Recebimento confirmado</strong><span>${escapeHtml(medication?.name || 'Medicamento')} · lembrete das ${escapeHtml(entry.scheduledTime)} · ${escapeHtml(formatDateTime(entry.confirmedAt))}</span></article>`;
  }).join('');
}

function callEventLabel(entry) {
  const labels = {
    'reminder-understood': 'Lembrete compreendido'
  };
  return labels[entry.event] || labels[entry.outcome] || 'Ligação demonstrativa registrada';
}

function renderCallHistory() {
  const history = document.querySelector('#call-history');
  const entries = (state.callHistory ?? []).filter((entry) => entry.event === 'reminder-understood');
  if (!entries.length) {
    history.innerHTML = '<p class="empty-state">Nenhuma ligação demonstrativa registrada neste aparelho.</p>';
    return;
  }
  history.innerHTML = entries.map((entry) => {
    const medication = entry.medicationId ? getMedication(state, entry.medicationId) : null;
    const detail = medication ? escapeHtml(medication.name) : 'Simulação do Cuidar+';
    return `<article class="history-item"><strong>${escapeHtml(callEventLabel(entry))}</strong><span>${detail} · ${escapeHtml(formatDateTime(entry.createdAt))} · simulação</span></article>`;
  }).join('');
}

function formatAppointmentDate(date) {
  const [year, month, day] = String(date).split('-');
  return { day, month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(Number(year), Number(month) - 1, Number(day))).replace('.', '').toUpperCase() };
}

function appointmentIsFuture(appointment, now = new Date()) {
  const moment = new Date(`${appointment.date}T${appointment.time || '00:00'}:00`);
  return !Number.isNaN(moment.getTime()) && moment.getTime() >= now.getTime();
}

function renderAppointments() {
  const list = document.querySelector('#appointment-list');
  const appointments = (state.appointments ?? [])
    .filter((appointment) => appointmentIsFuture(appointment))
    .sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`));
  if (!appointments.length) {
    list.innerHTML = '<p class="empty-state">Nenhuma consulta ou exame demonstrativo cadastrado.</p>';
    return;
  }
  list.innerHTML = appointments.map((appointment) => {
    const calendar = formatAppointmentDate(appointment.date);
    return `<article class="appointment-card"><time datetime="${escapeHtml(appointment.date)}"><strong>${escapeHtml(calendar.day)}</strong><span>${escapeHtml(calendar.month)}</span></time><div>
      <strong>${escapeHtml(appointment.title)}</strong><p>${escapeHtml(appointment.time)} · ${escapeHtml(appointment.location)}</p>
      <span class="appointment-reminder">● Lembrete ativado · demonstração</span>
      ${appointment.notes ? `<small>${escapeHtml(appointment.notes)}</small>` : ''}
      <button class="appointment-call-button" type="button" data-call-appointment="${escapeHtml(appointment.id)}">Simular ligação de lembrete</button>
    </div></article>`;
  }).join('');
  list.querySelectorAll('[data-call-appointment]').forEach((button) => {
    button.addEventListener('click', () => openCallSimulation('appointment', button.dataset.callAppointment));
  });
}

function renderServices() {
  const specialty = document.querySelector('#service-specialty-filter').value;
  const type = document.querySelector('#service-type-filter').value;
  const services = demonstrationServices.filter((service) => (specialty === 'all' || service.specialty === specialty) && (type === 'all' || service.type === type));
  const markup = services.length ? services.map((service) => `<article class="service-card"><span class="service-category">${escapeHtml(service.type)} · ${escapeHtml(service.specialty)}</span><strong>${escapeHtml(service.name)}</strong><p>${escapeHtml(service.description)}</p><div><button type="button" data-demo-action="Simular ligação para a unidade">Ligar (simulação)</button><button type="button" data-demo-action="Simular abertura de rota">Abrir rota (simulação)</button></div></article>`).join('') : '<p class="empty-state">Nenhum exemplo corresponde a esses filtros.</p>';
  document.querySelectorAll('#service-list, #family-service-list').forEach((list) => {
    list.innerHTML = markup;
    list.querySelectorAll('[data-demo-action]').forEach((button) => button.addEventListener('click', () => showFutureMessage(button.dataset.demoAction)));
  });
}

function setConsultationTab(tab) {
  const agenda = tab === 'agenda';
  document.querySelector('#agenda-panel').hidden = !agenda;
  document.querySelector('#search-panel').hidden = agenda;
  document.querySelector('#agenda-tab').classList.toggle('active', agenda);
  document.querySelector('#search-tab').classList.toggle('active', !agenda);
  document.querySelector('#agenda-tab').setAttribute('aria-selected', String(agenda));
  document.querySelector('#search-tab').setAttribute('aria-selected', String(!agenda));
  if (!agenda) renderServices();
}

function renderUbs() {
  const ubs = state.ubs ?? {};
  const card = document.querySelector('#ubs-reference-card');
  const name = ubs.name || 'UBS não cadastrada';
  const neighborhood = ubs.neighborhood ? `Bairro: ${ubs.neighborhood}` : 'Bairro não informado.';
  const address = ubs.address || 'Endereço não informado.';
  const phone = ubs.phone ? `Telefone: ${ubs.phone}` : 'Telefone não cadastrado.';
  card.innerHTML = `<span class="ubs-reference-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M8 56V25l24-14 24 14v31H8Zm14-19h20M32 27v20M14 18h36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 20v14M25 27h14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></span><div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(neighborhood)}</p><p>${escapeHtml(address)}</p><p>${escapeHtml(phone)}</p></div>`;

  const href = ubsPhoneHref();
  const callLink = document.querySelector('#ubs-call-link');
  const unavailableButton = document.querySelector('#ubs-call-unavailable');
  const phoneStatus = document.querySelector('#ubs-phone-status');
  callLink.hidden = !href;
  unavailableButton.hidden = Boolean(href);
  if (href) {
    callLink.href = href;
    phoneStatus.textContent = 'O botão abre o discador deste aparelho.';
  } else {
    phoneStatus.textContent = 'Telefone não cadastrado. O Cuidar+ não inventa números.';
  }
  ubsForm.elements.name.value = ubs.name || '';
  ubsForm.elements.neighborhood.value = ubs.neighborhood || '';
  ubsForm.elements.address.value = ubs.address || '';
  ubsForm.elements.phone.value = ubs.phone || '';
}

function renderFamily() {
  const reminder = getUpcomingReminder();
  const medication = reminder ? getMedication(state, reminder.medicationId) : null;
  const status = document.querySelector('#family-reminder-status');
  status.innerHTML = reminder
    ? `<span class="family-status-icon pending" aria-hidden="true">!</span><div><strong>Próximo lembrete</strong><p>${escapeHtml(medication?.name || 'Medicamento')} · ${escapeHtml(reminder.time)} · ${escapeHtml(reminderDayLabel(reminder))}.</p></div>`
    : '<div><strong>Sem próximos lembretes</strong></div>';
  const contacts = state.familyContacts ?? [];
  document.querySelector('#family-contact-list').innerHTML = contacts.length ? contacts.map((contact) => `<article class="family-contact-card"><span aria-hidden="true">●</span><div><strong>${escapeHtml(contact.name)}</strong><p>${escapeHtml(contact.relationship)}${contact.phone ? ` · ${escapeHtml(contact.phone)}` : ' · contato demonstrativo sem telefone real'}</p></div><small>Autorizado<br />· demonstração</small></article>`).join('') : '<p class="empty-state">Nenhum familiar demonstrativo vinculado.</p>';
}

function render() { renderHome(); renderMedicationList(); renderHistory(); renderCallHistory(); renderAppointments(); renderUbs(); renderFamily(); }
function showView(view) {
  const finder = view === 'finder';
  const medications = view === 'medications';
  const consultations = view === 'consultations';
  const family = view === 'family';
  const home = !finder && !medications && !consultations && !family;
  homeView.hidden = !home;
  medicationsView.hidden = !medications;
  finderView.hidden = !finder;
  consultationsView.hidden = !consultations;
  familyView.hidden = !family;
  welcome.hidden = !home;
  const activeNavigation = finder ? 'finder' : medications ? 'medications' : consultations ? 'consultations' : family ? 'family' : 'home';
  document.querySelectorAll('.bottom-nav [data-view]').forEach((button) => {
    const active = button.dataset.view === activeNavigation;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const pageTitles = { home: 'Início', medications: 'Meus medicamentos', finder: 'Encontrar medicamentos', consultations: 'Consultas e exames', family: 'Minha família' };
  document.title = `Cuidar+ | ${pageTitles[view] || pageTitles.home}`;
  document.querySelector('#conteudo').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function speakReminder() {
  const reminder = getUpcomingReminder();
  const medication = reminder ? getMedication(state, reminder.medicationId) : null;
  const message = medication
    ? `Olá! Aqui é o Cuidar Mais. Este é um lembrete demonstrativo de ${medication.name}, ${medication.dosage}, cadastrado para ${reminder.time}. Para confirmar que recebeu o lembrete, use o botão confirmar recebimento.`
    : 'Olá! Aqui é o Cuidar Mais. Não há lembrete demonstrativo disponível.';
  if (!('speechSynthesis' in window)) { showToast('A leitura em voz não está disponível neste navegador.'); return; }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = 'pt-BR';
  window.speechSynthesis.speak(speech);
  showToast('Reproduzindo o lembrete demonstrativo.');
}

function callMessageFor(kind) {
  if (kind === 'appointment') {
    const appointment = state.appointments?.find((item) => item.id === activeCallAppointmentId) ?? state.appointments?.[0];
    return appointment
      ? `Simulação do Cuidar Mais. ${appointment.title}, às ${appointment.time}, em ${appointment.location}.`
      : 'Simulação do Cuidar Mais. Lembrete de consulta ou exame.';
  }
  if (kind === 'ubs') return 'Ligação simulada para a UBS. Nenhuma unidade real foi contatada.';
  if (kind === 'acs') return 'Ligação simulada para o agente comunitário de saúde. Nenhuma pessoa real foi contatada.';
  const reminder = activeCallReminder ?? getUpcomingReminder();
  const medication = reminder ? getMedication(state, reminder.medicationId) : null;
  return medication
    ? `Simulação do Cuidar Mais. Lembrete de ${medication.name}, às ${reminder.time}.`
    : 'Simulação do Cuidar Mais. Lembrete de medicamento.';
}

function isReminderCall(kind = activeCallKind) {
  return kind === 'medication' || kind === 'appointment';
}

function setCallListeningStatus(message = '', hidden = !message) {
  callListeningStatus.textContent = message;
  callListeningStatus.hidden = hidden;
}

function stopVoiceRecognition() {
  if (voiceRecognition) {
    const currentRecognition = voiceRecognition;
    voiceRecognition = null;
    currentRecognition.onresult = null;
    currentRecognition.onerror = null;
    currentRecognition.onend = null;
    try { currentRecognition.abort(); } catch { /* A escuta já pode ter terminado. */ }
  }
  setCallListeningStatus();
}

function recordCallEvent(event, extra = {}) {
  state = addSimulationCallEvent(state, {
    kind: activeCallKind || 'medication',
    event,
    medicationId: activeCallKind === 'medication' ? activeCallReminder?.medicationId ?? null : null,
    ...extra
  });
  saveState();
  renderCallHistory();
}

function speakCallText(message, onend) {
  callSimulationMessage.textContent = message;
  if (!('speechSynthesis' in window)) {
    onend?.();
    return false;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = 'pt-BR';
  speech.rate = 0.92;
  speech.onend = () => {
    if (!callSimulation.hidden) onend?.();
  };
  speech.onerror = () => {
    if (!callSimulation.hidden) onend?.();
  };
  window.speechSynthesis.speak(speech);
  return true;
}

function askIfUnderstood() {
  speakCallText('Você entendeu o lembrete?', startVoiceRecognition);
}

function speakCallReminder() {
  const message = callMessageFor(activeCallKind);
  speakCallText(message, askIfUnderstood);
}

function retryVoiceRecognition() {
  recognitionAttempts += 1;
  if (recognitionAttempts > MAX_QUESTION_REPETITIONS) {
    setCallListeningStatus('Não foi possível entender. Toque em Encerrar.', false);
    return;
  }
  askIfUnderstood();
}

function confirmReminderUnderstanding() {
  if (!isReminderCall()) return;
  stopVoiceRecognition();
  if (activeCallKind === 'medication' && activeCallReminder) {
    state = acknowledgeReminderUnderstanding(state, activeCallReminder);
    saveState();
    render();
  }
  recordCallEvent('reminder-understood');
  speakCallText('Tudo bem. Até logo!', () => closeCallSimulation('call-ended', { alreadyRecorded: true }));
}

function handleVoiceResponse(transcript) {
  const response = String(transcript).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,!?]/g, '').trim();
  if (/^(sim|entendi|entendi sim)$/.test(response)) return confirmReminderUnderstanding();
  retryVoiceRecognition();
}

function startVoiceRecognition() {
  if (callSimulation.hidden || !isReminderCall() || !callAnswered) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setCallListeningStatus('Voz não disponível. Toque em Encerrar.', false);
    return;
  }
  stopVoiceRecognition();
  const recognition = new Recognition();
  voiceRecognition = recognition;
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let settled = false;
  setCallListeningStatus('Ouvindo…', false);
  recognition.onresult = (event) => {
    settled = true;
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    voiceRecognition = null;
    setCallListeningStatus();
    handleVoiceResponse(transcript);
  };
  recognition.onerror = (event) => {
    if (settled) return;
    settled = true;
    voiceRecognition = null;
    if (event.error === 'no-speech') {
      retryVoiceRecognition();
      return;
    }
    const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microfone não autorizado. Toque em Encerrar.'
      : 'Não foi possível ouvir. Toque em Encerrar.';
    setCallListeningStatus(message, false);
  };
  recognition.onend = () => {
    if (!settled && voiceRecognition === recognition) {
      voiceRecognition = null;
      retryVoiceRecognition();
    }
  };
  try {
    recognition.start();
  } catch {
    voiceRecognition = null;
    setCallListeningStatus('Voz não disponível. Toque em Encerrar.', false);
  }
}

function openCallSimulation(kind = 'medication', appointmentId = null) {
  activeCallKind = kind;
  activeCallAppointmentId = appointmentId;
  activeCallReminder = kind === 'medication' ? getUpcomingReminder() : null;
  recognitionAttempts = 0;
  callAnswered = false;
  setCallListeningStatus();
  answerSimulatedCallButton.hidden = !isReminderCall(kind);
  callSimulationRecipient.textContent = kind === 'ubs' ? 'Chamando UBS — simulação' : kind === 'acs' ? 'Chamando ACS — simulação' : 'Chamada simulada para Maria';
  callSimulationMessage.textContent = kind === 'ubs' || kind === 'acs' ? 'Chamando…' : 'Ligação recebida. Toque em “Atender” para ouvir o lembrete.';
  callSimulation.hidden = false;
  if (kind === 'ubs' || kind === 'acs') {
    window.setTimeout(() => {
      if (!callSimulation.hidden && activeCallKind === kind) callSimulationMessage.textContent = 'Ligação simulada em andamento. Nenhuma chamada real foi feita.';
    }, 700);
  }
}

function closeCallSimulation(outcome = 'call-ended', { alreadyRecorded = false } = {}) {
  if (!activeCallKind) return;
  stopVoiceRecognition();
  if (!alreadyRecorded) {
    if (!isReminderCall()) {
      state = addSimulationCallRecord(state, { kind: activeCallKind, outcome });
      saveState();
      renderCallHistory();
    }
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  callSimulation.hidden = true;
  activeCallKind = null;
  activeCallAppointmentId = null;
  activeCallReminder = null;
}

function addScheduleField() {
  const index = scheduleFields.querySelectorAll('input').length + 1;
  const label = document.createElement('label');
  label.textContent = `Horário ${index}`;
  const input = document.createElement('input');
  input.name = 'times';
  input.type = 'time';
  input.required = true;
  label.append(input);
  scheduleFields.append(label);
  input.focus();
}
function resetProgramming() {
  editingMedicationId = null;
  calculatedTimes = [];
  medicationForm.reset();
  setScheduleFields([]);
  frequencyInput.value = '';
  intervalInput.value = '';
  customFrequencyInput.value = '';
  customIntervalInput.value = '';
  firstTimeInput.value = '';
  syncProgrammingFields();
  syncFirstDoseSchedule();
  cancelEditButton.hidden = true;
  medicationForm.querySelector('[type="submit"]').textContent = 'Salvar medicamento demonstrativo';
}

function setProgrammingValue(value, input, customInput) {
  if (value?.startsWith('custom:')) {
    input.value = 'custom';
    customInput.value = value.replace('custom:', '');
  } else {
    input.value = value || '';
    customInput.value = '';
  }
}

function startEditingMedication(medicationId) {
  const medication = getMedication(state, medicationId);
  if (!medication) return;
  editingMedicationId = medicationId;
  medicationForm.elements.name.value = medication.name;
  medicationForm.elements.dosage.value = medication.dosage;
  medicationForm.elements.startDate.value = medication.startDate || '';
  medicationForm.elements.endDate.value = medication.endDate || '';
  medicationForm.elements.notes.value = medication.notes || '';
  const firstDose = medication.firstDoseStatus === 'not-taken' ? 'not-taken' : 'now';
  medicationForm.querySelector(`input[name="firstDoseStatus"][value="${firstDose}"]`).checked = true;
  setProgrammingValue(medication.frequency || '', frequencyInput, customFrequencyInput);
  setProgrammingValue(medication.intervalHours || '', intervalInput, customIntervalInput);
  firstTimeInput.value = medication.firstTime || '';
  syncProgrammingFields();
  calculatedTimes = [];
  setScheduleFields(medication.times);
  if (medication.firstDoseStatus === 'not-taken') {
    syncFirstDoseSchedule();
  } else if (medication.firstTime && medication.intervalHours) {
    const interval = String(medication.intervalHours).replace('custom:', '');
    showCalculatedSchedule(medication.times, interval);
  } else {
    calculatedSchedule.hidden = true;
  }
  cancelEditButton.hidden = false;
  medicationForm.querySelector('[type="submit"]').textContent = 'Salvar alterações de horários';
  document.querySelector('.medicine-form-panel').open = true;
  medicationForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

fontToggle.addEventListener('click', () => {
  const enabled = document.documentElement.classList.toggle('large-text');
  fontToggle.setAttribute('aria-pressed', String(enabled));
  fontToggle.setAttribute('aria-label', enabled ? 'Voltar ao tamanho padrão do texto' : 'Aumentar tamanho do texto');
  showToast(enabled ? 'Texto aumentado.' : 'Texto no tamanho padrão.');
});
voiceMenuButton.addEventListener('click', () => {
  if (assistantVoiceRecognition) {
    stopAssistantVoiceRecognition();
    setVoiceMenuStatus('Assistente de voz interrompido. Use os botões Ouvir quando quiser.', false);
    return;
  }
  pendingAssistantAction = null;
  startAssistantVoiceRecognition();
});
homeVoiceMenuButton.addEventListener('click', () => voiceMenuButton.click());
document.querySelector('[data-read-page]').addEventListener('click', () => {
  if (!medicationsView.hidden) return readAssistantSection('medications');
  if (!consultationsView.hidden) return readAssistantSection('consultations');
  if (!familyView.hidden) return readAssistantSection('family');
  const answer = createVoiceResponse(state, 'next-medication', { now: new Date(), nextReminder: getUpcomingReminder() });
  speakAssistantResponse(answer);
});
document.querySelectorAll('[data-assistant-read]').forEach((button) => button.addEventListener('click', () => readAssistantSection(button.dataset.assistantRead)));
voiceAssistantRepeatButton.addEventListener('click', () => {
  if (!lastAssistantResponse) return;
  speakAssistantResponse({ text: lastAssistantResponse, requiresCallConfirmation: pendingAssistantAction === 'ubs-call' });
});
voiceAssistantRetryButton.addEventListener('click', () => {
  pendingAssistantAction = null;
  startAssistantVoiceRecognition();
});
voiceAssistantConfirmCallButton.addEventListener('click', confirmAssistantUbsCall);
voiceAssistantCancelCallButton.addEventListener('click', () => {
  stopAssistantVoiceRecognition();
  pendingAssistantAction = null;
  speakAssistantResponse({ text: 'Ligação cancelada.' });
});
document.querySelectorAll('[data-view]').forEach((element) => element.addEventListener('click', () => showView(element.dataset.view)));
document.querySelectorAll('[data-demo-action]').forEach((element) => element.addEventListener('click', () => showFutureMessage(element.dataset.demoAction)));
document.querySelectorAll('[data-open-medicine-finder]').forEach((button) => button.addEventListener('click', () => {
  focusMedicineFinder();
}));
openUbsFinderButton.addEventListener('click', () => {
  showView('finder');
  finderSearchButton.focus({ preventScroll: true });
  showToast('Encontre a UBS e confirme o telefone antes de ligar.');
});
finderSearchButton.addEventListener('click', findNearbyUnits);
document.querySelector('#repeat-reminder').addEventListener('click', speakReminder);
document.querySelector('#simulate-reminder-call').addEventListener('click', () => openCallSimulation('medication'));
answerSimulatedCallButton.addEventListener('click', () => {
  if (!isReminderCall()) return;
  callAnswered = true;
  recognitionAttempts = 0;
  answerSimulatedCallButton.hidden = true;
  speakCallReminder();
});
document.querySelector('#end-simulated-call').addEventListener('click', () => {
  closeCallSimulation('call-ended');
  showToast('Ligação simulada encerrada.');
});
document.querySelector('#confirm-reminder').addEventListener('click', () => {
  const reminder = getUpcomingReminder();
  if (!reminder) return;
  state = acknowledgeReminderUnderstanding(state, reminder);
  saveState(); render();
  showToast('Lembrete compreendido. Mostramos o próximo horário.');
});
document.querySelector('#add-schedule').addEventListener('click', addScheduleField);
medicationForm.querySelectorAll('input[name="firstDoseStatus"]').forEach((input) => input.addEventListener('change', syncFirstDoseSchedule));
frequencyInput.addEventListener('change', () => {
  syncProgrammingFields();
  if (selectedFirstDoseStatus() === 'now') syncFirstDoseSchedule();
});
intervalInput.addEventListener('change', () => {
  syncProgrammingFields();
  if (selectedFirstDoseStatus() === 'now') syncFirstDoseSchedule();
});
customIntervalInput.addEventListener('change', () => {
  if (selectedFirstDoseStatus() === 'now') syncFirstDoseSchedule();
});
firstTimeInput.addEventListener('change', () => {
  if (getActualInterval()) calculateCurrentSchedule(false);
});
medicationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(medicationForm);
  formMessage.hidden = true;
  try {
    const scheduleValues = formData.getAll('times');
    const automaticSchedule = calculatedTimes.length > 0 && JSON.stringify(scheduleValues) === JSON.stringify(calculatedTimes);
    const firstDoseStatus = selectedFirstDoseStatus();
    if (!getStoredFrequency() || !getActualInterval()) {
      throw new Error('Informe a frequência e o intervalo exatamente como constam na receita.');
    }
    if (firstDoseStatus === 'now' && !calculatedTimes.length) {
      throw new Error('Confira os horários calculados antes de salvar.');
    }
    const values = {
      name: formData.get('name'), dosage: formData.get('dosage'), times: formData.getAll('times'),
      startDate: formData.get('startDate'), endDate: formData.get('endDate'), notes: formData.get('notes'),
      frequency: getStoredFrequency(), intervalHours: getStoredInterval(), firstTime: firstTimeInput.value, firstDoseStatus, automaticSchedule
    };
    state = editingMedicationId ? updateMedication(state, editingMedicationId, values) : addMedication(state, values);
    const message = editingMedicationId ? 'Programação de lembretes atualizada.' : 'Medicamento cadastrado no modo demonstração.';
    saveState(); resetProgramming(); render();
    showToast(message);
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.hidden = false;
  }
});
cancelEditButton.addEventListener('click', resetProgramming);
document.querySelector('#reset-demo').addEventListener('click', () => {
  if (!window.confirm('Restaurar os dados demonstrativos? Os cadastros feitos neste dispositivo serão removidos.')) return;
  state = createDemoState(); saveState(); resetProgramming(); render();
  showToast('Dados demonstrativos restaurados.');
});
document.querySelector('#agenda-tab').addEventListener('click', () => setConsultationTab('agenda'));
document.querySelector('#search-tab').addEventListener('click', () => setConsultationTab('search'));
document.querySelector('#service-specialty-filter').addEventListener('change', renderServices);
document.querySelector('#service-type-filter').addEventListener('change', renderServices);
appointmentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  appointmentFormMessage.hidden = true;
  const formData = new FormData(appointmentForm);
  try {
    state = addAppointment(state, {
      type: formData.get('type'), title: formData.get('title'), date: formData.get('date'),
      time: formData.get('time'), location: formData.get('location'), notes: formData.get('notes')
    });
    saveState();
    appointmentForm.reset();
    document.querySelector('#appointment-form-panel').open = false;
    renderAppointments();
    showToast('Compromisso demonstrativo salvo. Isso não confirma atendimento pela unidade.');
  } catch (error) {
    appointmentFormMessage.textContent = error.message;
    appointmentFormMessage.hidden = false;
  }
});
familyContactForm.addEventListener('submit', (event) => {
  event.preventDefault();
  familyContactMessage.hidden = true;
  const formData = new FormData(familyContactForm);
  try {
    state = addFamilyContact(state, {
      name: formData.get('name'), relationship: formData.get('relationship'), phone: formData.get('phone'), authorized: formData.get('authorized') === 'on'
    });
    saveState();
    familyContactForm.reset();
    renderFamily();
    showToast('Familiar vinculado no modo demonstração. O vínculo real exigirá autorização da pessoa idosa.');
  } catch (error) {
    familyContactMessage.textContent = error.message;
    familyContactMessage.hidden = false;
  }
});
ubsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  ubsFormMessage.hidden = true;
  const formData = new FormData(ubsForm);
  try {
    state = updateReferenceUbs(state, {
      name: formData.get('name'), neighborhood: formData.get('neighborhood'), address: formData.get('address'), phone: formData.get('phone')
    });
    saveState();
    renderUbs();
    ubsForm.closest('details').open = false;
    showToast('Informações da UBS atualizadas neste dispositivo.');
  } catch (error) {
    ubsFormMessage.textContent = error.message;
    ubsFormMessage.hidden = false;
  }
});
document.querySelector('#open-family-search').addEventListener('click', () => {
  const list = document.querySelector('#family-service-list');
  list.hidden = !list.hidden;
  if (!list.hidden) renderServices();
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt || isStandalone()) return;
  installButton.hidden = true;
  await deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  showToast(outcome === 'accepted' ? 'Aplicativo instalado.' : 'Instalação cancelada.');
  deferredInstallPrompt = undefined;
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = undefined;
  updateInstallButton();
  showToast('Cuidar+ instalado neste dispositivo.');
});
window.matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallButton);
if (!window.isSecureContext) console.warn('Cuidar+ PWA: a instalação exige HTTPS; localhost é a única exceção de desenvolvimento.');
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => console.info(`Cuidar+ PWA: Service Worker ativo no escopo ${registration.scope}`))
      .catch((error) => console.error('Cuidar+ PWA: falha ao registrar o Service Worker.', error));
  });
}

function refreshUpcomingReminder() {
  if (!callSimulation.hidden) return;
  renderHome();
  renderFamily();
}

window.setInterval(refreshUpcomingReminder, 30000);
window.addEventListener('focus', refreshUpcomingReminder);

resetProgramming();
render();
showView('home');
updateInstallButton();
