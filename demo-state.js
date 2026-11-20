export const DEMO_STORAGE_KEY = 'cuidar-mais-profile-state-v2';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDemoState() {
  return {
    medications: [
      {
        id: 'med-sinvastatina', name: 'Sinvastatina', dosage: '10 mg', times: ['21:00'],
        startDate: '', endDate: '', frequency: '1', intervalHours: '', firstTime: '21:00', firstDoseStatus: 'reported-now',
        notes: 'Horário informado para este protótipo.', active: true
      },
      {
        id: 'med-gestinol', name: 'Gestinol', dosage: '30 mcg', times: ['21:00'],
        startDate: '', endDate: '', frequency: '1', intervalHours: '', firstTime: '21:00', firstDoseStatus: 'reported-now',
        notes: 'Horário informado para este protótipo.', active: true
      },
      {
        id: 'med-tylenol-sinus', name: 'Tylenol Sinus', dosage: 'Dose não informada', times: ['06:00', '14:00', '22:00'],
        startDate: '', endDate: '', frequency: '3', intervalHours: '8', firstTime: '06:00', firstDoseStatus: 'reported-now',
        notes: 'Horários simulados para o protótipo; confira a orientação recebida antes de usar.', active: true
      }
    ],
    reminder: { medicationId: 'med-sinvastatina', time: '21:00', status: 'pending', confirmedAt: null },
    history: [],
    appointments: [
      {
        id: 'appointment-geriatry-demo', type: 'Consulta', title: 'Consulta com geriatra',
        date: '2026-11-24', time: '09:00', location: 'Unidade de saúde demonstrativa',
        notes: 'Exemplo de compromisso fictício.', reminder: true, status: 'scheduled'
      },
      {
        id: 'appointment-blood-demo', type: 'Exame', title: 'Exame de sangue',
        date: '2026-11-27', time: '07:30', location: 'Laboratório demonstrativo',
        notes: 'Exemplo de compromisso fictício.', reminder: true, status: 'scheduled'
      }
    ],
    familyContacts: [
      { id: 'family-ana-demo', name: 'Ana', relationship: 'Filha', phone: '(00) 00000-0000', authorized: true }
    ],
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
  if (!name || !relationship || !phone || values.authorized !== true) {
    throw new Error('Informe nome, relação, telefone e a autorização demonstrativa.');
  }
  const nextState = clone(state);
  nextState.familyContacts = [...(nextState.familyContacts ?? []), { id, name, relationship, phone, authorized: true }];
  return nextState;
}

export function addSimulationCallRecord(state, values, id = `call-${Date.now()}`) {
  const nextState = clone(state);
  nextState.callHistory = [{
    id,
    kind: String(values.kind ?? 'medication'),
    outcome: String(values.outcome ?? 'ended'),
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
