const CNES_BASE_URL = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos';
const CUIABA_IBGE_CODE = '510340';
const PAGE_SIZE = 20;
const MAX_PAGES_PER_TYPE = 10;
const UNIT_TYPES = [
  { code: '1', label: 'Posto de saúde' },
  { code: '2', label: 'Unidade básica de saúde' }
];

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getCoordinates(record) {
  const latitude = Number(record.latitude_estabelecimento_decimo_grau);
  const longitude = Number(record.longitude_estabelecimento_decimo_grau);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0
    ? { latitude, longitude }
    : null;
}

function getAddress(record) {
  const street = [asText(record.endereco_estabelecimento), asText(record.numero_estabelecimento)]
    .filter(Boolean)
    .join(', ');
  const locality = [asText(record.bairro_estabelecimento), 'Cuiabá - MT'].filter(Boolean).join(' · ');
  const postalCode = asText(record.codigo_cep_estabelecimento);
  return [street, locality, postalCode ? `CEP ${postalCode}` : ''].filter(Boolean).join(' — ');
}

export function normalizeCnesUnit(record, unitType) {
  const code = String(record.codigo_cnes ?? record.codigo_estabelecimento_saude ?? '').trim();
  if (!code || !asText(record.nome_fantasia)) return null;

  return {
    id: `cnes-${code}`,
    cnes: code,
    name: asText(record.nome_fantasia),
    type: unitType.label,
    typeCode: unitType.code,
    address: getAddress(record),
    phone: asText(record.numero_telefone_estabelecimento) || null,
    coordinates: getCoordinates(record),
    updatedAt: asText(record.data_atualizacao) || null,
    source: 'Cadastro Nacional de Estabelecimentos de Saúde (CNES)'
  };
}

async function fetchUnitType(fetchImpl, unitType) {
  const units = [];
  for (let page = 0; page < MAX_PAGES_PER_TYPE; page += 1) {
    const url = new URL(CNES_BASE_URL);
    url.searchParams.set('codigo_municipio', CUIABA_IBGE_CODE);
    url.searchParams.set('codigo_tipo_unidade', unitType.code);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(page * PAGE_SIZE));

    const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`CNES respondeu HTTP ${response.status}`);
    const payload = await response.json();
    const records = Array.isArray(payload.estabelecimentos) ? payload.estabelecimentos : [];
    const normalized = records.map((record) => normalizeCnesUnit(record, unitType)).filter(Boolean);
    units.push(...normalized);

    if (records.length < PAGE_SIZE) break;
  }
  return units;
}

export async function fetchCuiabaPublicHealthUnits(fetchImpl = fetch) {
  const pages = await Promise.all(UNIT_TYPES.map((unitType) => fetchUnitType(fetchImpl, unitType)));
  const seen = new Set();
  return pages.flat().filter((unit) => {
    if (seen.has(unit.id)) return false;
    seen.add(unit.id);
    return true;
  }).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const units = await fetchCuiabaPublicHealthUnits();
    response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    sendJson(response, 200, {
      city: { name: 'Cuiabá', ibgeCode: CUIABA_IBGE_CODE },
      fetchedAt: new Date().toISOString(),
      sources: [
        {
          name: 'Cadastro Nacional de Estabelecimentos de Saúde (CNES)',
          url: CNES_BASE_URL,
          detail: 'Tipos 01 — Posto de saúde e 02 — Centro de saúde/Unidade básica de saúde.'
        }
      ],
      units
    });
  } catch (error) {
    response.setHeader('Cache-Control', 'no-store');
    sendJson(response, 503, {
      error: 'Não foi possível atualizar a lista de unidades oficiais agora.',
      detail: error instanceof Error ? error.message : 'Falha desconhecida.'
    });
  }
}
