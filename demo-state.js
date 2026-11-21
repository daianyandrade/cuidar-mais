export const DEMO_STORAGE_KEY = 'cuidar-mais-profile-state-v3';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDemoState() {
  return {
    mode: 'demonstration',
    demoProfileVersion: 'tech-show-2026',
    medications: [
      {
        id: 'med-losartana-demo', name: 'Losartana', dosage: '50 mg', times: ['08:00', '20:00'],
        startDate: '', endDate: '', frequency: '2', intervalHours: '12', firstTime: '08:00', firstDoseStatus: 'reported-now',
        notes: 'Dado fictício para a mostra de tecnologia.', active: true
      },
      {
        id: 'med-omeprazol-demo', name: 'Omeprazol', dosage: '20 mg', times: ['07:00'],
        startDate: '', endDate: '', frequency: '1', intervalHours: '24', firstTime: '07:00', firstDoseStatus: 'reported-now',
        notes: 'Dado fictício para a mostra de tecnologia.', active: true
      }
    ],
    reminder: { medicationId: 'med-losartana-demo', time: '08:00', status: 'pending', confirmedAt: null },
    reminderAcknowledgements: [],
    history: [],
    appointments: [
      {
        id: 'appointment-cardiology-demo', type: 'Consulta', title: 'Cardiologia',
        date: '2026-11-25', time: '14:00', location: 'Unidade de saúde demonstrativa',
        notes: 'Dado fictício para a mostra de tecnologia.', reminder: true, status: 'scheduled'
      },
      {
        id: 'appointment-blood-demo', type: 'Exame', title: 'Exame de sangue',
        date: '2026-11-28', time: '07:00', location: 'Laboratório demonstrativo',
        notes: 'Dado fictício para a mostra de tecnologia.', reminder: true, status: 'scheduled'
      }
    ],
    familyContacts: [
      { id: 'family-ana-demo', name: 'Ana', relationship: 'Filha', phone: '', authorized: true }
    ],
    ubs: {
      name: 'UBS de Demonstração Cuidar+',
      neighborhood: 'Bairro Demonstrativo',
      address: 'Endereço fictício — apenas para apresentação',
      phone: ''
    },
    callHistory: [],
    doseHistory: []
  };
}

export function getMedication(state, medicationId) {
  return state.medications.find((medication) => medication.id === medicationId);
}

export function getReminderCount(state) {
  return state.medications.filter((medication) => medication.active)
    .reduce((total, medication) => total + medication.times.length, 0);
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function reminderMoment(date, time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

function hasAcknowledgement(state, medicationId, time, date) {
  return (state.reminderAcknowledgements ?? []).some((entry) => (
    entry.medicationId === medicationId && entry.time === time && entry.date === date
  ));
}

export function getNextScheduledReminder(state, now = new Date()) {
  const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
  const dates = [
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  ];
  const candidates = [];
  for (const date of dates) {
    for (const medication of state.medications ?? []) {
      if (!medication.active || medication.firstDoseStatus === 'not-taken') continue;
      for (const time of medication.times ?? []) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) continue;
        const moment = reminderMoment(date, time);
        const scheduleDate = localDateKey(moment);
        if (moment.getTime() < currentMinute.getTime() || hasAcknowledgement(state, medication.id, time, scheduleDate)) continue;
        candidates.push({ medicationId: medication.id, time: String(time), date: scheduleDate, at: moment.toISOString() });
      }
    }
  }
  return candidates.sort((first, second) => first.at.localeCompare(second.at))[0] ?? null;
}

export function acknowledgeReminderUnderstanding(state, reminder, understoodAt = new Date().toISOString()) {
  if (!reminder?.medicationId || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(reminder.time)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(reminder.date))) {
    throw new Error('Lembrete programado não encontrado.');
  }
  const nextState = clone(state);
  const existing = nextState.reminderAcknowledgements ?? [];
  if (!existing.some((entry) => entry.medicationId === reminder.medicationId && entry.time === reminder.time && entry.date === reminder.date)) {
    nextState.reminderAcknowledgements = [{
      medicationId: reminder.medicationId, time: reminder.time, date: reminder.date, understoodAt
    }, ...existing].slice(0, 120);
  }
  return nextState;
}

export function calculateSchedule(firstTime, intervalHours) {
  const [hours, minutes] = String(firstTime).split(':').map(Number);
  const interval = Number(intervalHours);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Informe o primeiro horário no formato de horas e minutos.');
  }
  if (!Number.isFinite(interval) || interval <= 0 || interval > 24) {
    throw new Error('Informe um intervalo entre 1 e 24 horas.');
  }

  const firstMinutes = (hours * 60) + minutes;
  const intervalMinutes = interval * 60;
  const times = [];
  for (let offset = 0; offset < 1440; offset += intervalMinutes) {
    const moment = (firstMinutes + offset) % 1440;
    times.push(`${String(Math.floor(moment / 60)).padStart(2, '0')}:${String(moment % 60).padStart(2, '0')}`);
  }
  return times;
}

function normalizeTimes(times, keepOrder = false) {
  const uniqueTimes = [...new Set((times ?? []).map((time) => String(time).trim()).filter(Boolean))];
  return keepOrder ? uniqueTimes : uniqueTimes.sort();
}

export function addMedication(state, values, id = `med-${Date.now()}`) {
  const name = String(values.name ?? '').trim();
  const dosage = String(values.dosage ?? '').trim();
  const times = normalizeTimes(values.times, values.automaticSchedule === true);
  const startDate = String(values.startDate ?? '');
  const endDate = String(values.endDate ?? '');
  const awaitingFirstDose = values.firstDoseStatus === 'not-taken';
  if (!name || !dosage || (times.length === 0 && !awaitingFirstDose)) throw new Error('Informe o nome, a dosagem e a programação conforme a receita.');
  if (endDate && startDate && endDate < startDate) throw new Error('A data de término não pode ser anterior à data de início.');

  const nextState = clone(state);
  nextState.medications.unshift({
    id, name, dosage, times, startDate, endDate, notes: String(values.notes ?? '').trim(), active: true,
    frequency: String(values.frequency ?? ''), intervalHours: String(values.intervalHours ?? ''), firstTime: String(values.firstTime ?? ''),
    firstDoseStatus: awaitingFirstDose ? 'not-taken' : 'reported-now'
  });
  return nextState;
}

export function updateMedication(state, medicationId, values) {
  const previous = getMedication(state, medicationId);
  if (!previous) throw new Error('Medicamento demonstrativo não encontrado.');
  const updated = addMedication({ ...state, medications: state.medications.filter((medication) => medication.id !== medicationId) }, values, medicationId);
  const nextState = clone(updated);
  const medication = getMedication(nextState, medicationId);
  medication.active = previous.active;
  return nextState;
}

export function addAppointment(state, values, id = `appointment-${Date.now()}`) {
  const type = String(values.type ?? '').trim();
  const title = String(values.title ?? '').trim();
  const date = String(values.date ?? '');
  const time = String(values.time ?? '');
  const location = String(values.location ?? '').trim();
  if (!type || !title || !date || !time || !location) {
    throw new Error('Informe o tipo, o compromisso, a data, o horário e o local.');
  }
  const nextState = clone(state);
  nextState.appointments = [...(nextState.appointments ?? []), {
    id, type, title, date, time, location, notes: String(values.notes ?? '').trim(), reminder: true, status: 'scheduled'
  }].sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`));
  return nextState;
}

export function addFamilyContact(state, values, id = `family-${Date.now()}`) {
  const name = String(values.name ?? '').trim();
  const relationship = String(values.relationship ?? '').trim();
  const phone = String(values.phone ?? '').trim();
  if (!name || !relationship || values.authorized !== true) {
    throw new Error('Informe nome, relação e a autorização demonstrativa. O telefone é opcional.');
  }
  const nextState = clone(state);
  nextState.familyContacts = [...(nextState.familyContacts ?? []), { id, name, relationship, phone, authorized: true }];
  return nextState;
}

export function updateReferenceUbs(state, values) {
  const name = String(values.name ?? '').trim();
  const neighborhood = String(values.neighborhood ?? '').trim();
  const address = String(values.address ?? '').trim();
  const phone = String(values.phone ?? '').trim();
  if (!name || !neighborhood || !address) {
    throw new Error('Informe o nome, o bairro e o endereço da UBS.');
  }
  const nextState = clone(state);
  nextState.ubs = { name, neighborhood, address, phone };
  return nextState;
}

export function addSimulationCallRecord(state, values, id = `call-${Date.now()}`) {
  return addSimulationCallEvent(state, {
    ...values,
    event: values.event ?? values.outcome ?? 'call-ended'
  }, id);
}

export function addSimulationCallEvent(state, values, id = `call-${Date.now()}`) {
  const nextState = clone(state);
  nextState.callHistory = [{
    id,
    kind: String(values.kind ?? 'medication'),
    event: String(values.event ?? values.outcome ?? 'call-ended'),
    outcome: String(values.outcome ?? values.event ?? 'call-ended'),
    medicationId: values.medicationId ? String(values.medicationId) : null,
    scheduledFor: values.scheduledFor ? String(values.scheduledFor) : null,
    createdAt: values.createdAt ?? new Date().toISOString(),
    demonstration: true
  }, ...(nextState.callHistory ?? [])];
  return nextState;
}

export function addDoseSelfReport(state, values, id = `dose-${Date.now()}`) {
  const nextState = clone(state);
  nextState.doseHistory = [{
    id, medicationId: values.medicationId, reportedAt: values.reportedAt ?? new Date().toISOString(),
    source: 'user-report', verified: false
  }, ...(nextState.doseHistory ?? [])];
  return nextState;
}

export function confirmReminder(state, confirmedAt = new Date().toISOString()) {
  const nextState = clone(state);
  if (nextState.reminder.status === 'confirmed') return nextState;
  nextState.reminder.status = 'confirmed';
  nextState.reminder.confirmedAt = confirmedAt;
  nextState.history.unshift({
    id: `history-${confirmedAt}`, medicationId: nextState.reminder.medicationId,
    scheduledTime: nextState.reminder.time, status: 'confirmed', confirmedAt
  });
  return nextState;
}

export function postponeReminder(state, time, postponedAt = new Date().toISOString()) {
  const scheduledTime = String(time ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
    throw new Error('Escolha um novo hor\u00e1rio para adiar o lembrete.');
  }
  const nextState = clone(state);
  nextState.reminder.time = scheduledTime;
  nextState.reminder.status = 'pending';
  nextState.reminder.confirmedAt = null;
  nextState.reminder.postponedAt = postponedAt;
  return nextState;
}
