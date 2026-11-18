import { DEMO_STORAGE_KEY, addAppointment, addDoseSelfReport, addFamilyContact, addMedication, addSimulationCallRecord, calculateSchedule, confirmReminder, createDemoState, getMedication, getReminderCount, updateMedication } from './demo-state.js';

const fontToggle = document.querySelector('[data-font-toggle]');
const toast = document.querySelector('.toast');
const installButton = document.querySelector('#install-app');
const homeView = document.querySelector('#home-view');
const medicationsView = document.querySelector('#medications-view');
const consultationsView = document.querySelector('#consultations-view');
const familyView = document.querySelector('#family-view');
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
const callSimulation = document.querySelector('#call-simulation');
const callSimulationMessage = document.querySelector('#call-simulation-message');
const callSimulationRecipient = document.querySelector('#call-simulation-recipient');
let activeCallKind = null;
let repeatCallMessage = false;
let toastTimer;
let deferredInstallPrompt;
let state = loadState();
let calculatedTimes = [];
let editingMedicationId = null;
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
        callHistory: Array.isArray(savedState.callHistory) ? savedState.callHistory : defaults.callHistory
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

function renderHome() {
  const reminder = state.reminder;
  const medication = getMedication(state, reminder.medicationId);
  const confirmed = reminder.status === 'confirmed';
  document.querySelector('#home-reminder-details').innerHTML = medication
    ? `${escapeHtml(medication.name)} ${escapeHtml(medication.dosage)} às <strong>${escapeHtml(reminder.time)}</strong>`
    : 'Nenhum lembrete demonstrativo disponível.';
  const total = getReminderCount(state);
  document.querySelector('#daily-summary').innerHTML = `<strong>Hoje:</strong> ${total} ${total === 1 ? 'lembrete programado' : 'lembretes programados'}.`;
  const status = document.querySelector('#home-reminder-status');
  status.textContent = confirmed ? 'Recebimento confirmado (demonstração)' : 'Lembrete pendente de confirmação';
  status.className = `reminder-status ${confirmed ? 'confirmed' : 'pending'}`;
  const confirmButton = document.querySelector('#confirm-reminder');
  confirmButton.disabled = confirmed;
  confirmButton.textContent = confirmed ? 'Recebimento confirmado' : 'Confirmar recebimento';
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
      <button class="text-button find-medication" type="button" data-find-medication="${escapeHtml(medication.name)}">Encontrar onde retirar</button>
      <button class="text-button edit-medication" type="button" data-edit-medication="${escapeHtml(medication.id)}">Editar programação</button>
    </div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit-medication]').forEach((button) => {
    button.addEventListener('click', () => startEditingMedication(button.dataset.editMedication));
  });
  list.querySelectorAll('[data-find-medication]').forEach((button) => {
    button.addEventListener('click', () => focusMedicineFinder(button.dataset.findMedication));
  });
}

function focusMedicineFinder(medicationName) {
  const finder = document.querySelector('#finder-medication-input');
  finder.value = medicationName;
  document.querySelector('#medicine-finder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  finder.focus({ preventScroll: true });
  showToast('Medicamento preenchido. Consulte a fonte oficial para verificar a unidade e a disponibilidade atual.');
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

function formatAppointmentDate(date) {
  const [year, month, day] = String(date).split('-');
  return { day, month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(Number(year), Number(month) - 1, Number(day))).replace('.', '').toUpperCase() };
}

function renderAppointments() {
  const list = document.querySelector('#appointment-list');
  const appointments = state.appointments ?? [];
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
    </div></article>`;
  }).join('');
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

function renderFamily() {
  const reminder = state.reminder;
  const medication = getMedication(state, reminder.medicationId);
  const status = document.querySelector('#family-reminder-status');
  const confirmed = reminder.status === 'confirmed';
  status.innerHTML = `<span class="family-status-icon ${confirmed ? 'confirmed' : 'pending'}" aria-hidden="true">${confirmed ? '✓' : '!'}</span><div><strong>${confirmed ? 'Lembrete confirmado' : 'Lembrete pendente'}</strong><p>${escapeHtml(medication?.name || 'Medicamento')} · ${escapeHtml(reminder.time)} · ${confirmed ? 'Ana pode visualizar a confirmação demonstrativa.' : 'A ausência de confirmação não representa emergência.'}</p></div>`;
  const contacts = state.familyContacts ?? [];
  document.querySelector('#family-contact-list').innerHTML = contacts.length ? contacts.map((contact) => `<article class="family-contact-card"><span aria-hidden="true">●</span><div><strong>${escapeHtml(contact.name)}</strong><p>${escapeHtml(contact.relationship)} · ${escapeHtml(contact.phone)}</p></div><small>Autorizado<br />· demonstração</small></article>`).join('') : '<p class="empty-state">Nenhum familiar demonstrativo vinculado.</p>';
}

function render() { renderHome(); renderMedicationList(); renderHistory(); renderAppointments(); renderFamily(); }
function showView(view) {
  const medications = view === 'medications';
  const consultations = view === 'consultations';
  const family = view === 'family';
  homeView.hidden = medications || consultations || family;
  medicationsView.hidden = !medications;
  consultationsView.hidden = !consultations;
  familyView.hidden = !family;
  welcome.hidden = medications || consultations || family;
  document.querySelectorAll('.bottom-nav [data-view]').forEach((button) => {
    const active = button.dataset.view === (medications ? 'medications' : consultations ? 'consultations' : family ? 'family' : 'home');
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.querySelector('#conteudo').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function speakReminder() {
  const reminder = state.reminder;
  const medication = getMedication(state, reminder.medicationId);
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
    const appointment = state.appointments?.[0];
    return appointment ? `Olá, Maria. Você tem ${appointment.type.toLowerCase()} agendado para ${appointment.time}, em ${appointment.location}. Esta é uma demonstração.` : 'Olá, Maria. Esta é uma demonstração de lembrete de consulta.';
  }
  if (kind === 'ubs') return 'Ligação simulada para a UBS. Nenhuma unidade real foi contatada.';
  if (kind === 'acs') return 'Ligação simulada para o agente comunitário de saúde. Nenhuma pessoa real foi contatada.';
  const medication = getMedication(state, state.reminder.medicationId);
  return medication ? `Olá, Maria. Este é um lembrete do Cuidar Mais. Está na hora do medicamento ${medication.name}, cadastrado para as ${state.reminder.time}.` : 'Olá, Maria. Este é um lembrete demonstrativo do Cuidar Mais.';
}

function speakCallMessage() {
  const message = callMessageFor(activeCallKind);
  callSimulationMessage.textContent = message;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = 'pt-BR';
  speech.onend = () => {
    if (repeatCallMessage && !callSimulation.hidden && activeCallKind === 'medication') {
      window.setTimeout(speakCallMessage, 600);
    }
  };
  window.speechSynthesis.speak(speech);
}

function openCallSimulation(kind = 'medication') {
  activeCallKind = kind;
  repeatCallMessage = false;
  const answer = document.querySelector('#answer-simulated-call');
  const confirm = document.querySelector('#call-confirm-receipt');
  answer.hidden = kind === 'ubs' || kind === 'acs';
  confirm.hidden = kind === 'ubs' || kind === 'acs';
  callSimulationRecipient.textContent = kind === 'ubs' ? 'Chamando UBS — simulação' : kind === 'acs' ? 'Chamando ACS — simulação' : 'Chamada para Maria';
  callSimulationMessage.textContent = kind === 'ubs' || kind === 'acs' ? 'Chamando…' : 'Ligação recebida.';
  callSimulation.hidden = false;
  if (kind === 'ubs' || kind === 'acs') {
    window.setTimeout(() => {
      if (!callSimulation.hidden && activeCallKind === kind) callSimulationMessage.textContent = 'Ligação simulada em andamento. Nenhuma chamada real foi feita.';
    }, 700);
  }
}

function closeCallSimulation(outcome = 'ended') {
  if (!activeCallKind) return;
  repeatCallMessage = false;
  state = addSimulationCallRecord(state, { kind: activeCallKind, outcome });
  saveState();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  callSimulation.hidden = true;
  activeCallKind = null;
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
document.querySelector('[data-read-page]').addEventListener('click', () => medicationsView.hidden ? speakReminder() : showToast('Use “Ouvir novamente” na tela inicial para reproduzir o lembrete.'));
document.querySelectorAll('[data-view]').forEach((element) => element.addEventListener('click', () => showView(element.dataset.view)));
document.querySelectorAll('[data-demo-action]').forEach((element) => element.addEventListener('click', () => showFutureMessage(element.dataset.demoAction)));
document.querySelector('#repeat-reminder').addEventListener('click', speakReminder);
document.querySelector('#simulate-reminder-call').addEventListener('click', () => openCallSimulation('medication'));
document.querySelector('#answer-simulated-call').addEventListener('click', () => {
  repeatCallMessage = true;
  speakCallMessage();
});
document.querySelector('#call-confirm-receipt').addEventListener('click', () => {
  repeatCallMessage = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (activeCallKind === 'medication') state = addDoseSelfReport(state, { medicationId: state.reminder.medicationId });
  closeCallSimulation('self-reported-taken');
  render();
  showToast('Dose informada como tomada pelo usuário. Este registro não comprova a ingestão.');
});
document.querySelector('#end-simulated-call').addEventListener('click', () => {
  closeCallSimulation('ended');
  showToast('Ligação simulada encerrada.');
});
document.querySelector('#confirm-reminder').addEventListener('click', () => {
  if (state.reminder.status === 'confirmed') return;
  state = confirmReminder(state);
  saveState(); render();
  showToast('Recebimento do lembrete confirmado. Isso não comprova que o medicamento foi ingerido.');
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
document.querySelector('#simulate-family-call').addEventListener('click', () => {
  openCallSimulation('medication');
});
document.querySelector('#simulate-ubs-call').addEventListener('click', () => openCallSimulation('ubs'));
document.querySelector('#simulate-acs-call').addEventListener('click', () => openCallSimulation('acs'));
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

resetProgramming();
render();
updateInstallButton();
