import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { addAppointment, addDoseSelfReport, addFamilyContact, addMedication, addSimulationCallEvent, addSimulationCallRecord, calculateSchedule, confirmReminder, createDemoState, getReminderCount, postponeReminder, updateMedication } from '../demo-state.js';
import { fetchCuiabaPublicHealthUnits, normalizeCnesUnit } from '../api/cuiaba-units.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('a página inicial apresenta o cartão prioritário de medicamentos', () => {
  assert.match(html, /Meus\s*<br\s*\/?\s*>\s*Medicamentos/);
  assert.match(html, /Foco principal/);
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
  assert.equal(getReminderCount(state), 7);
});

test('o perfil inicial registra os horários autorizados e identifica o horário simulado', () => {
  const state = createDemoState();
  const sinvastatina = state.medications.find((medication) => medication.id === 'med-sinvastatina');
  const gestinol = state.medications.find((medication) => medication.id === 'med-gestinol');
  const tylenol = state.medications.find((medication) => medication.id === 'med-tylenol-sinus');
  assert.deepEqual(sinvastatina.times, ['21:00']);
  assert.deepEqual(gestinol.times, ['21:00']);
  assert.deepEqual(tylenol.times, ['06:00', '14:00', '22:00']);
  assert.match(tylenol.notes, /simulados/i);
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
  const state = updateMedication(initialState, 'med-sinvastatina', {
    name: 'Sinvastatina', dosage: '10 mg', times: ['07:00', '19:00'],
    intervalHours: '12', firstTime: '07:00', frequency: '2', automaticSchedule: true
  });
  assert.deepEqual(state.medications[0].times, ['07:00', '19:00']);
  assert.equal(state.medications[0].dosage, '10 mg');
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

test('a página identifica ligações e permissões familiares como demonstração', () => {
  assert.match(html, /Lembrete por ligação/);
  assert.match(html, /Nenhuma chamada real será feita/);
  assert.match(html, /Permissões de acesso/);
});

test('o cartão principal usa uma cápsula realista com fundo transparente', async () => {
  const capsule = await readFile(new URL('../icons/capsule-realistic.png', import.meta.url));
  assert.match(html, /src="\/icons\/capsule-realistic\.png"/);
  assert.deepEqual([...capsule.subarray(1, 4)], [80, 78, 71]);
  assert.ok(capsule.readUInt32BE(16) >= 512);
  assert.ok(capsule.readUInt32BE(20) >= 512);
});

test('a ligação da Mostra é uma simulação registrada sem afirmar chamada real', () => {
  const state = addSimulationCallRecord(createDemoState(), { kind: 'medication', outcome: 'received', createdAt: '2026-11-18T14:00:00.000Z' });
  assert.equal(state.callHistory[0].demonstration, true);
  assert.equal(state.callHistory[0].outcome, 'received');
  assert.match(html, /Cuidar\+ — Simulação/);
  assert.match(html, />Atender</);
  assert.match(html, />Confirmar recebimento</);
  assert.match(html, />Encerrar</);
  assert.match(html, /Nenhuma chamada real será feita/);
});

test('informar que tomou é separado do recebimento do lembrete', () => {
  const state = addDoseSelfReport(createDemoState(), { medicationId: 'med-sinvastatina', reportedAt: '2026-11-18T08:05:00.000Z' });
  assert.equal(state.doseHistory[0].source, 'user-report');
  assert.equal(state.doseHistory[0].verified, false);
});

test('o modal da ligação fecha sem registrar dose como tomada', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.call-simulation\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(script, /closeCallSimulation\('call-ended'\)/);
  assert.doesNotMatch(script, /callConfirmReceiptButton\.addEventListener\('click',[\s\S]{0,250}addDoseSelfReport/);
});

test('a ligação demonstrativa registra eventos separados e pode adiar o lembrete', () => {
  let state = createDemoState();
  state = addSimulationCallEvent(state, { kind: 'medication', event: 'reminder-sent', medicationId: 'med-sinvastatina', createdAt: '2026-11-18T08:00:00.000Z' });
  state = addSimulationCallEvent(state, { kind: 'medication', event: 'call-answered', medicationId: 'med-sinvastatina', createdAt: '2026-11-18T08:01:00.000Z' });
  state = postponeReminder(state, '22:30', '2026-11-18T08:02:00.000Z');
  state = addSimulationCallEvent(state, { kind: 'medication', event: 'reminder-postponed', medicationId: 'med-sinvastatina', scheduledFor: '22:30', createdAt: '2026-11-18T08:02:00.000Z' });
  assert.equal(state.reminder.time, '22:30');
  assert.equal(state.reminder.status, 'pending');
  assert.equal(state.callHistory[0].event, 'reminder-postponed');
  assert.equal(state.callHistory[0].scheduledFor, '22:30');
  assert.equal(state.doseHistory.length, 0);
});

test('a simulação usa voz do navegador com escuta limitada e alternativa manual', () => {
  assert.match(script, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /MAX_VOICE_RECOGNITION_ATTEMPTS = 2/);
  assert.match(script, /MAX_CALL_MESSAGE_REPEATS = 2/);
  assert.match(script, /Ouvindo sua resposta/);
  assert.match(script, /not-allowed/);
  assert.match(html, /id="call-postpone-time"/);
  assert.match(html, /id="repeat-call-message"/);
  assert.match(html, /id="call-listening-status"/);
  assert.match(html, /Histórico de ligações demonstrativas/);
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
