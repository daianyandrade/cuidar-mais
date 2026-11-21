import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { acknowledgeReminderUnderstanding, addAppointment, addDoseSelfReport, addFamilyContact, addMedication, addSimulationCallEvent, addSimulationCallRecord, calculateSchedule, confirmReminder, createDemoState, getNextScheduledReminder, getReminderCount, updateMedication, updateReferenceUbs } from '../demo-state.js';
import { fetchCuiabaPublicHealthUnits, normalizeCnesUnit } from '../api/cuiaba-units.js';
import { createMenuReading, createVoiceResponse, identifyVoiceCommand } from '../voice-assistant.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('a página inicial apresenta o cartão prioritário de medicamentos', () => {
  assert.match(html, /id="medicine-title">Medicamentos</);
  assert.match(html, /Foco principal/);
});

test('a página inicial segue o modelo de cartões largos com voz em destaque', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(html, /class="profile-avatar"/);
  assert.match(html, /Olá, Dona Maria!/);
  assert.match(html, /shortcut-card blue/);
  assert.match(html, /shortcut-card orange/);
  assert.match(html, /shortcut-card purple/);
  assert.match(html, /id="home-voice-menu"/);
  assert.match(html, /Falar com o/);
  assert.match(html, /home-summary-grid/);
  assert.match(html, /appointment-summary-card/);
  assert.match(html, /data-view="finder"/);
  assert.match(styles, /#home-view > \.shortcut-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(styles, /\.app-view \.view-heading\s*\{[^}]*linear-gradient/s);
});

test('a página apresenta avisos de demonstração e segurança', () => {
  assert.match(html, /dados de demonstração/i);
  assert.match(html, /não substitui orientação profissional/i);
});

test('os recursos básicos de acessibilidade possuem controles', () => {
  assert.match(html, /data-font-toggle/);
  assert.match(html, /data-read-page/);
  assert.match(script, /speechSynthesis/);
});

test('o menu oferece comando de voz com retorno visual e mantém a navegação por botões', () => {
  assert.match(html, /id="voice-menu-toggle"/);
  assert.match(html, /id="voice-menu-status"/);
  assert.match(script, /function menuDestinationFor/);
  assert.match(script, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /recognition\.continuous = false/);
  assert.match(script, /Ouvindo: diga “Início”, “Medicamentos”, “Consultas”, “Família”, “Encontrar medicamentos” ou “Ligar para os Bombeiros”/);
  assert.match(script, /Microfone não autorizado\. Use os botões do menu/);
  assert.match(script, /showView\(destination\)/);
  assert.match(html, /data-view="medications"/);
});

test('o assistente de voz consulta os dados demonstrativos e prepara respostas faladas', () => {
  const state = createDemoState();
  const now = new Date(2026, 10, 21, 9, 0, 0);
  assert.equal(identifyVoiceCommand('Quais medicamentos eu tomo?'), 'medications');
  assert.equal(identifyVoiceCommand('Quando é minha próxima consulta?'), 'next-appointment');
  assert.equal(identifyVoiceCommand('Quais exames tenho?'), 'exams');
  assert.equal(identifyVoiceCommand('Qual é minha UBS?'), 'ubs');
  assert.equal(identifyVoiceCommand('Quero ligar para meu posto de saúde'), 'ubs-call');
  assert.equal(identifyVoiceCommand('Ligar para os Bombeiros'), 'emergency-call');
  const medications = createVoiceResponse(state, 'medications', { now });
  assert.match(medications.text, /Losartana, 50 mg/);
  assert.match(medications.text, /Omeprazol, 20 mg/);
  const nextAppointment = createVoiceResponse(state, 'next-appointment', { now });
  assert.match(nextAppointment.text, /Cardiologia/);
  assert.match(nextAppointment.text, /25 de novembro de 2026/);
  const exams = createVoiceResponse(state, 'exams', { now });
  assert.match(exams.text, /Exame de sangue/);
  const ubs = createVoiceResponse(state, 'ubs', { now });
  assert.match(ubs.text, /UBS de Demonstração Cuidar\+/);
  assert.match(ubs.text, /telefone não cadastrado/);
  const contacts = createMenuReading(state, 'family', { now });
  assert.match(contacts.text, /Ana, Filha, contato demonstrativo sem telefone real/);
  const expiredAgenda = createVoiceResponse(state, 'agenda', { now: new Date(2026, 11, 1, 9, 0, 0) });
  assert.match(expiredAgenda.text, /Não há consultas ou exames futuros cadastrados/);
});

test('os controles de ouvir e a resposta visível usam o mesmo assistente de voz', () => {
  assert.match(html, /id="voice-assistant-response"/);
  assert.match(html, /id="voice-assistant-message"/);
  assert.match(html, /data-assistant-read="medications"/);
  assert.match(html, /data-assistant-read="consultations"/);
  assert.match(html, /data-assistant-read="family"/);
  assert.match(html, /data-assistant-read="ubs"/);
  assert.match(html, /id="ubs-form"/);
  assert.match(html, /id="ubs-call-link"/);
  assert.match(script, /createVoiceResponse/);
  assert.match(script, /createMenuReading/);
  assert.match(script, /startAssistantVoiceRecognition/);
  assert.match(script, /new SpeechSynthesisUtterance\(answer\.text\)/);
  assert.match(script, /requiresCallConfirmation/);
  assert.match(script, /dialEmergency/);
  assert.match(script, /window\.location\.href = href/);
});

test('o aplicativo oferece a estrutura necessária para instalação web', async () => {
  const manifest = await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(manifest, /"name": "Cuidar\+"/);
  assert.match(manifest, /"short_name": "Cuidar\+"/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"start_url": "\/"/);
  assert.match(manifest, /"scope": "\/"/);
  assert.match(manifest, /"prefer_related_applications": false/);
  assert.match(serviceWorker, /addEventListener\('fetch'/);
  assert.match(script, /serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/);
  assert.match(script, /beforeinstallprompt/);
  assert.match(script, /appinstalled/);
  assert.match(script, /isStandalone/);
  const buildScript = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(buildScript, /'voice-assistant\.js'/);
});

test('o manifesto declara ícones PNG válidos para instalação Android', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  const expectedIcons = [
    { source: '../icons/icon-192.png', size: 192 },
    { source: '../icons/icon-512.png', size: 512 }
  ];
  for (const expected of expectedIcons) {
    const icon = manifest.icons.find((entry) => entry.src === `/${expected.source.replace('../', '')}` && entry.type === 'image/png');
    assert.ok(icon, `ícone ${expected.size}px deve estar no manifesto`);
    assert.equal(icon.sizes, `${expected.size}x${expected.size}`);
    const bytes = await readFile(new URL(expected.source, import.meta.url));
    assert.deepEqual([...bytes.subarray(1, 4)], [80, 78, 71]);
    assert.equal(bytes.readUInt32BE(16), expected.size);
    assert.equal(bytes.readUInt32BE(20), expected.size);
  }
});

test('a publicação Vercel evita que o service worker fique desatualizado', async () => {
  const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercelConfig.framework, null);
  assert.equal(vercelConfig.outputDirectory, 'dist');
  const serviceWorkerHeaders = vercelConfig.headers.find((entry) => entry.source === '/sw.js');
  assert.ok(serviceWorkerHeaders);
  assert.match(serviceWorkerHeaders.headers[0].value, /no-cache/);
});

test('o medicamento demonstrativo pode ser cadastrado com horários', () => {
  const state = addMedication(createDemoState(), {
    name: 'Vitamina D', dosage: 'Conforme receita', times: ['18:00', '08:00'], notes: 'Dado fictício.'
  }, 'med-vitamina-demo');
  assert.equal(state.medications[0].name, 'Vitamina D');
  assert.deepEqual(state.medications[0].times, ['08:00', '18:00']);
  assert.equal(getReminderCount(state), 5);
});

test('o perfil de demonstração usa apenas os dados fictícios definidos para a mostra', () => {
  const state = createDemoState();
  const losartana = state.medications.find((medication) => medication.id === 'med-losartana-demo');
  const omeprazol = state.medications.find((medication) => medication.id === 'med-omeprazol-demo');
  assert.deepEqual(losartana.times, ['08:00', '20:00']);
  assert.deepEqual(omeprazol.times, ['07:00']);
  assert.equal(state.appointments[0].date, '2026-11-25');
  assert.equal(state.appointments[1].date, '2026-11-28');
  assert.equal(state.ubs.name, 'UBS de Demonstração Cuidar+');
  assert.equal(state.ubs.phone, '');
  assert.equal(state.familyContacts[0].phone, '');
});

test('o cadastro pode aguardar a primeira dose sem registrar um horário inventado', () => {
  const state = addMedication(createDemoState(), {
    name: 'Medicamento da receita', dosage: '10 mg', times: [], frequency: '2', intervalHours: '12', firstDoseStatus: 'not-taken'
  }, 'med-aguardando-dose');
  assert.equal(state.medications[0].firstDoseStatus, 'not-taken');
  assert.deepEqual(state.medications[0].times, []);
});

test('a programação automática calcula horários a partir do primeiro horário e intervalo', () => {
  assert.deepEqual(calculateSchedule('06:00', 8), ['06:00', '14:00', '22:00']);
  assert.deepEqual(calculateSchedule('06:00', 6), ['06:00', '12:00', '18:00', '00:00']);
});

test('a edição permite atualizar a programação sem alterar a dosagem por sugestão', () => {
  const initialState = createDemoState();
  const state = updateMedication(initialState, 'med-losartana-demo', {
    name: 'Losartana', dosage: '50 mg', times: ['07:00', '19:00'],
    intervalHours: '12', firstTime: '07:00', frequency: '2', automaticSchedule: true
  });
  assert.deepEqual(state.medications[0].times, ['07:00', '19:00']);
  assert.equal(state.medications[0].dosage, '50 mg');
});

test('a agenda demonstrativa possui consultas e exames e aceita novo compromisso', () => {
  const initialState = createDemoState();
  assert.equal(initialState.appointments.length, 2);
  const state = addAppointment(initialState, {
    type: 'Consulta', title: 'Clínica geral', date: '2026-11-30', time: '10:30', location: 'Local demonstrativo'
  }, 'appointment-clinic-demo');
  assert.equal(state.appointments.length, 3);
  assert.equal(state.appointments.at(-1).title, 'Clínica geral');
});

test('a página diferencia agenda de busca de atendimento demonstrativa', () => {
  assert.match(html, /Minha agenda/);
  assert.match(html, /Buscar atendimento/);
  assert.match(html, /não significa ter consulta disponível/i);
  assert.match(html, /Saúde da pessoa idosa/);
});

test('a família demonstrativa acompanha o idoso mediante autorização', () => {
  const initialState = createDemoState();
  assert.equal(initialState.familyContacts[0].name, 'Ana');
  const state = addFamilyContact(initialState, {
    name: 'João', relationship: 'Filho', phone: '(00) 00000-0000', authorized: true
  }, 'family-joao-demo');
  assert.equal(state.familyContacts.length, 2);
  assert.equal(state.familyContacts[1].authorized, true);
});

test('a UBS pode ser atualizada sem criar telefone fictício', () => {
  const state = updateReferenceUbs(createDemoState(), {
    name: 'UBS Exemplo', neighborhood: 'Bairro Exemplo', address: 'Rua Exemplo, 10', phone: ''
  });
  assert.equal(state.ubs.name, 'UBS Exemplo');
  assert.equal(state.ubs.phone, '');
});

test('a página preserva permissões familiares e evita duplicar ligações simuladas', () => {
  assert.match(html, /Permissões de acesso/);
  assert.doesNotMatch(html, /Testar ligação simulada/);
  assert.doesNotMatch(html, /Simular ligação para UBS/);
  assert.doesNotMatch(html, /Simular ligação para ACS/);
});

test('a família oferece ligação real para emergência sem simulação', () => {
  assert.match(html, /id="my-ubs-title">Minha UBS/);
  assert.match(html, /id="linked-family-title">Minha família/);
  assert.match(html, /id="emergency-title">Emergência/);
  assert.match(html, /Corpo de Bombeiros/);
  assert.match(html, /href="tel:193"/);
  assert.match(html, /Ligar para os Bombeiros/);
  assert.match(html, /capacidade deste dispositivo realizar chamadas/);
  assert.match(script, /return 'emergency-dial'/);
  assert.match(script, /window\.location\.href = 'tel:193'/);
  assert.match(script, /Ligar para os Bombeiros/);
  assert.doesNotMatch(html, /Simular ligação para os Bombeiros/);
});

test('o cartão principal usa uma cápsula realista com fundo transparente', async () => {
  const capsule = await readFile(new URL('../icons/capsule-realistic.png', import.meta.url));
  assert.match(html, /src="\/icons\/capsule-realistic\.png"/);
  assert.deepEqual([...capsule.subarray(1, 4)], [80, 78, 71]);
  assert.ok(capsule.readUInt32BE(16) >= 512);
  assert.ok(capsule.readUInt32BE(20) >= 512);
});

test('a saudação usa o retrato realista da personagem demonstrativa', async () => {
  const avatar = await readFile(new URL('../icons/dona-maria-avatar-v1.png', import.meta.url));
  assert.match(html, /src="\/icons\/dona-maria-avatar-v1\.png"/);
  assert.deepEqual([...avatar.subarray(1, 4)], [80, 78, 71]);
  assert.ok(avatar.readUInt32BE(16) >= 512);
});

test('a ligação da Mostra é uma simulação registrada sem afirmar chamada real', () => {
  const state = addSimulationCallRecord(createDemoState(), { kind: 'medication', outcome: 'received', createdAt: '2026-11-18T14:00:00.000Z' });
  assert.equal(state.callHistory[0].demonstration, true);
  assert.equal(state.callHistory[0].outcome, 'received');
  assert.match(html, /Cuidar\+ — Simulação/);
  assert.match(html, />Atender</);
  assert.match(html, />Encerrar</);
  assert.doesNotMatch(html, /id="call-confirm-receipt"/);
  assert.match(script, /recordCallEvent\('reminder-understood'\)/);
});

test('informar que tomou é separado do recebimento do lembrete', () => {
  const state = addDoseSelfReport(createDemoState(), { medicationId: 'med-sinvastatina', reportedAt: '2026-11-18T08:05:00.000Z' });
  assert.equal(state.doseHistory[0].source, 'user-report');
  assert.equal(state.doseHistory[0].verified, false);
});

test('a confirmação por voz não registra dose como tomada', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.call-simulation\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(script, /closeCallSimulation\('call-ended'\)/);
  assert.match(script, /recordCallEvent\('reminder-understood'\)/);
  assert.doesNotMatch(script, /function confirmReminderUnderstanding\(\) \{[\s\S]{0,350}confirmReminder\(/);
});

test('a ligação demonstrativa registra apenas que o lembrete foi compreendido', () => {
  let state = createDemoState();
  state = addSimulationCallEvent(state, { kind: 'medication', event: 'reminder-understood', medicationId: 'med-losartana-demo', createdAt: '2026-11-18T08:02:00.000Z' });
  assert.equal(state.reminder.time, '08:00');
  assert.equal(state.reminder.status, 'pending');
  assert.equal(state.callHistory[0].event, 'reminder-understood');
  assert.equal(state.doseHistory.length, 0);
});

test('o próximo lembrete acompanha o horário real e avança após ser compreendido', () => {
  const now = new Date(2026, 10, 20, 13, 0, 0);
  const initialState = createDemoState();
  const first = getNextScheduledReminder(initialState, now);
  assert.deepEqual({ medicationId: first.medicationId, time: first.time, date: first.date }, {
    medicationId: 'med-losartana-demo', time: '20:00', date: '2026-11-20'
  });
  const state = acknowledgeReminderUnderstanding(initialState, first, '2026-11-20T13:01:00.000Z');
  const next = getNextScheduledReminder(state, now);
  assert.deepEqual({ medicationId: next.medicationId, time: next.time, date: next.date }, {
    medicationId: 'med-omeprazol-demo', time: '07:00', date: '2026-11-21'
  });
  const atTheSameMinute = getNextScheduledReminder(initialState, new Date(2026, 10, 20, 20, 0, 30));
  assert.deepEqual({ medicationId: atTheSameMinute.medicationId, time: atTheSameMinute.time }, {
    medicationId: 'med-losartana-demo', time: '20:00'
  });
  const afterLosartana = acknowledgeReminderUnderstanding(initialState, atTheSameMinute, '2026-11-20T20:00:35.000Z');
  assert.equal(getNextScheduledReminder(afterLosartana, new Date(2026, 10, 20, 20, 0, 40)).medicationId, 'med-omeprazol-demo');
  assert.equal(state.doseHistory.length, 0);
  assert.equal(state.reminder.status, 'pending');
});

test('a simulação faz uma pergunta curta e encerra após confirmação por voz', () => {
  assert.match(script, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /MAX_QUESTION_REPETITIONS = 1/);
  assert.match(script, /Você entendeu o lembrete\?/);
  assert.match(script, /\^\(sim\|entendi\|entendi sim\)\$/);
  assert.match(script, /Tudo bem\. Até logo!/);
  assert.match(script, /Ouvindo…/);
  assert.match(script, /not-allowed/);
  assert.match(script, /data-call-appointment/);
  assert.match(script, /getNextScheduledReminder\(state, new Date\(\)\)/);
  assert.match(script, /acknowledgeReminderUnderstanding\(state, activeCallReminder\)/);
  assert.match(script, /window\.setInterval\(refreshUpcomingReminder, 30000\)/);
  assert.match(html, /id="call-listening-status"/);
  assert.match(html, /Histórico de ligações demonstrativas/);
  assert.doesNotMatch(html, /id="call-postpone-time"/);
});

test('consultas e exames permanece centrado na agenda e a busca fica disponível na família', () => {
  assert.match(html, /Próximos agendamentos/);
  assert.match(html, /Encontrar atendimento próximo/);
  assert.match(html, /Ver exemplos de atendimento/);
});

test('a busca de medicamentos mantém as unidades públicas no Cuidar+ e separa a consulta de estoque oficial', () => {
  assert.match(html, /Medicamentos perto de você/);
  assert.match(html, /id="finder-search"/);
  assert.match(html, /estoque-farmacias-cuiaba\.web\.app/);
  assert.match(html, /Consultar estoque oficial/);
  assert.match(html, /Esta busca não consulta o estoque municipal/);
  assert.match(script, /focusMedicineFinder/);
  assert.match(script, /fetch\('\/api\/cuiaba-units'/);
  assert.match(html, /Unidades perto de mim/);
  assert.match(html, /até 10 km/);
  assert.match(script, /FINDER_RADIUS_KM = 10/);
  assert.match(script, /navigator\.geolocation/);
  assert.doesNotMatch(html, /finder-use-location/);
});

test('a busca de unidades abre em uma tela própria, separada da lista de medicamentos', () => {
  assert.match(html, /id="medications-view" class="app-view"[^>]*hidden/);
  assert.match(html, /id="finder-view" class="app-view"/);
  assert.match(html, /data-view="medications">‹ Voltar/);
  assert.match(script, /const finderView = document\.querySelector\('#finder-view'\)/);
  assert.match(script, /showView\('finder'\)/);
});

test('as telas ocultas não ocupam espaço abaixo da tela ativa', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(script, /showView\('home'\)/);
});

test('os medicamentos cadastrados oferecem botões grandes para encontrar unidades e editar a programação', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(script, /medication-item-actions/);
  assert.match(script, />Encontrar unidades</);
  assert.match(script, />Editar programação</);
  assert.match(styles, /\.medication-list-action\s*\{[^}]*min-height:\s*48px/s);
});

test('a integração normaliza somente campos oficiais do CNES e preserva a atualização do cadastro', async () => {
  const record = {
    codigo_cnes: '1234567', nome_fantasia: 'UNIDADE TESTE', endereco_estabelecimento: 'Rua Exemplo',
    numero_estabelecimento: '20', bairro_estabelecimento: 'Centro', codigo_cep_estabelecimento: '78000000',
    numero_telefone_estabelecimento: '6530000000', latitude_estabelecimento_decimo_grau: '-15.60',
    longitude_estabelecimento_decimo_grau: '-56.10', data_atualizacao: '2026-03-03'
  };
  const normalized = normalizeCnesUnit(record, { code: '2', label: 'Unidade básica de saúde' });
  assert.equal(normalized.name, 'UNIDADE TESTE');
  assert.equal(normalized.phone, '6530000000');
  assert.deepEqual(normalized.coordinates, { latitude: -15.6, longitude: -56.1 });
  assert.equal(normalized.updatedAt, '2026-03-03');
  assert.equal('stock' in normalized, false);

  const urls = [];
  const units = await fetchCuiabaPublicHealthUnits(async (url) => {
    urls.push(url.toString());
    return { ok: true, json: async () => ({ estabelecimentos: [record] }) };
  });
  assert.equal(units.length, 1);
  assert.ok(urls.every((url) => url.includes('codigo_municipio=510340')));
});

test('confirmar um lembrete registra recebimento, sem registrar medicamento ingerido', () => {
  const state = confirmReminder(createDemoState(), '2026-11-18T08:05:00.000Z');
  assert.equal(state.reminder.status, 'confirmed');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].status, 'confirmed');
});
