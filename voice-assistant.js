function normalizeText(value = '') {
  return String(value)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(time) {
  const [hour = '', minute = ''] = String(time).split(':');
  if (!hour || !minute) return String(time || 'horário não informado');
  return `${Number(hour)} ${Number(hour) === 1 ? 'hora' : 'horas'} e ${Number(minute)} minutos`;
}

function formatTimes(times = []) {
  const values = times.map(formatTime);
  if (!values.length) return 'horário não informado';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`;
}

function formatDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return 'data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
}

function appointmentMoment(appointment) {
  return new Date(`${appointment.date}T${appointment.time || '00:00'}:00`);
}

function futureAppointments(state, now = new Date()) {
  return [...(state.appointments ?? [])]
    .filter((appointment) => {
      const moment = appointmentMoment(appointment);
      return !Number.isNaN(moment.getTime()) && moment.getTime() >= now.getTime();
    })
    .sort((first, second) => appointmentMoment(first) - appointmentMoment(second));
}

function appointmentSentence(appointment) {
  const title = appointment.title || appointment.type || 'compromisso';
  const location = appointment.location ? `, em ${appointment.location}` : '';
  return `${appointment.type || 'Compromisso'}: ${title}, em ${formatDate(appointment.date)}, às ${formatTime(appointment.time)}${location}`;
}

function medicationSentence(medication) {
  const name = medication.name || 'Medicamento';
  const dosage = medication.dosage ? `, ${medication.dosage}` : '';
  const singular = (medication.times ?? []).length === 1;
  return `${name}${dosage}, com horário${singular ? '' : 's'} previsto${singular ? '' : 's'} para ${formatTimes(medication.times)}`;
}

function response(text, intent, options = {}) {
  return { text, intent, ...options };
}

export function identifyVoiceCommand(transcript) {
  const command = normalizeText(transcript);
  if (!command) return 'unknown';
  if (/\b(ligar|ligue|chamar|chame)\b/.test(command) && /\b(bombeiro|bombeiros)\b/.test(command)) return 'emergency-call';
  if (/\b(confirmar|confirma|sim|pode ligar)\b/.test(command)) return 'confirm-call';
  if (/\b(cancelar|cancela|nao|nao quero)\b/.test(command)) return 'cancel-call';
  if (/\b(ligar|ligue|chamar|chame)\b/.test(command) && /\b(ubs|posto|unidade|saude)\b/.test(command)) return 'ubs-call';
  if (/\b(telefone|onde fica|qual e|qual a|minha)\b/.test(command) && /\b(ubs|posto|unidade)\b/.test(command)) return 'ubs';
  if (/\b(ubs|posto de saude|unidade de saude)\b/.test(command)) return 'ubs';
  if (/\b(contato|contatos|familia|familiar|filha|filho|cuidador)\b/.test(command)) return 'family';
  if (/\b(proxima|proximo|quando)\b/.test(command) && /\b(consulta|exame|agenda)\b/.test(command)) return 'next-appointment';
  if (/\b(exame|exames)\b/.test(command)) return 'exams';
  if (/\b(consulta|consultas)\b/.test(command)) return 'consultations';
  if (/\b(agenda|compromissos)\b/.test(command)) return 'agenda';
  if (/\b(proximo|proxima|quando|que horas|horario)\b/.test(command) && /\b(medicamento|medicamentos|remedio|remedios)\b/.test(command)) return 'next-medication';
  if (/\b(medicamento|medicamentos|remedio|remedios)\b/.test(command)) return 'medications';
  return 'unknown';
}

export function createVoiceResponse(state, intent, { now = new Date(), nextReminder = null } = {}) {
  const medications = state.medications ?? [];
  const ubs = state.ubs;
  const contacts = state.familyContacts ?? [];
  const future = futureAppointments(state, now);

  if (intent === 'emergency-call') {
    return response('Abrindo o discador para o Corpo de Bombeiros, 193.', intent, { dialEmergency: true });
  }

  if (intent === 'medications') {
    if (!medications.length) return response('Não há medicamentos cadastrados.', intent);
    return response(`Seus medicamentos cadastrados são: ${medications.map(medicationSentence).join('. ')}.`, intent);
  }
  if (intent === 'next-medication') {
    const medication = nextReminder?.medicationId ? medications.find((item) => item.id === nextReminder.medicationId) : medications[0];
    if (!medication) return response('Não há medicamentos cadastrados.', intent);
    const time = nextReminder?.time || medication.times?.[0];
    return response(time ? `Seu próximo medicamento é ${medication.name}, ${medication.dosage}, previsto para ${formatTime(time)}.` : `${medication.name}, ${medication.dosage}, não tem horário cadastrado.`, intent);
  }
  if (intent === 'consultations' || intent === 'exams') {
    const type = intent === 'consultations' ? 'consulta' : 'exame';
    const matches = future.filter((appointment) => normalizeText(appointment.type) === type);
    if (!matches.length) return response(`Não há ${type === 'consulta' ? 'consultas' : 'exames'} futuros cadastrados.`, intent);
    return response(`${type === 'consulta' ? 'Suas consultas' : 'Seus exames'} futuros são: ${matches.map(appointmentSentence).join('. ')}.`, intent);
  }
  if (intent === 'agenda') {
    if (!future.length) return response('Não há consultas ou exames futuros cadastrados.', intent);
    return response(`Sua agenda futura é: ${future.map(appointmentSentence).join('. ')}.`, intent);
  }
  if (intent === 'next-appointment') {
    const appointment = future[0];
    if (!appointment) return response('Não há consultas ou exames futuros cadastrados.', intent);
    return response(`Seu próximo compromisso é: ${appointmentSentence(appointment)}.`, intent);
  }
  if (intent === 'ubs') {
    if (!ubs?.name) return response('Não há uma UBS cadastrada. Cadastre uma unidade na área Minha UBS.', intent);
    const parts = [ubs.name];
    if (ubs.neighborhood) parts.push(`no bairro ${ubs.neighborhood}`);
    if (ubs.address) parts.push(`endereço ${ubs.address}`);
    parts.push(ubs.phone ? `telefone ${ubs.phone}` : 'telefone não cadastrado');
    return response(`Sua UBS é ${parts.join(', ')}.`, intent);
  }
  if (intent === 'ubs-call') {
    if (!ubs?.phone) return response('Não há telefone cadastrado para a sua UBS. Por segurança, não vou abrir o discador.', intent);
    return response(`Deseja abrir o discador para ${ubs.name}? Diga confirmar ligação ou toque em Confirmar ligação.`, intent, { requiresCallConfirmation: true });
  }
  if (intent === 'family') {
    if (!contacts.length) return response('Não há contatos familiares cadastrados.', intent);
    const list = contacts.map((contact) => {
      const relation = contact.relationship ? `, ${contact.relationship}` : '';
      const phone = contact.phone ? `, telefone ${contact.phone}` : ', contato demonstrativo sem telefone real';
      return `${contact.name || 'Contato'}${relation}${phone}`;
    });
    return response(`Seus contatos são: ${list.join('. ')}.`, intent);
  }
  return response('Não entendi. Você pode perguntar sobre medicamentos, agenda, exames, sua UBS ou família.', 'unknown');
}

export function createMenuReading(state, section, options = {}) {
  const intentBySection = { medications: 'medications', consultations: 'agenda', family: 'family', ubs: 'ubs' };
  return createVoiceResponse(state, intentBySection[section] || 'unknown', options);
}

export { normalizeText };
