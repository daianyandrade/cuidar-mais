# Cuidar+

Protótipo acadêmico instalável de uma interface de apoio à organização de lembretes de saúde para pessoas idosas. Esta primeira etapa implementa apenas a estrutura e a tela inicial, usando informações fictícias de demonstração.

## Executar

O projeto não requer instalação de pacotes. Com o Node.js instalado, execute no PowerShell:

```powershell
npm.cmd run serve
```

Abra `http://localhost:4173` no navegador. Para usar outra porta, defina a variável `PORT` antes de iniciar o servidor.

### Abrir no celular durante o desenvolvimento

`localhost` funciona apenas no mesmo aparelho em que o servidor foi iniciado. Com o computador e o celular conectados à mesma rede Wi-Fi, inicie o projeto com `npm.cmd run serve` e abra no celular o endereço **Cuidar+ disponível na rede Wi-Fi** mostrado no terminal, por exemplo `http://192.168.0.10:4173`.

Se o endereço não abrir, permita o Node.js na rede privada quando o Windows solicitar a permissão de firewall. Para acesso fora da sua rede Wi-Fi, publique o projeto em uma hospedagem com HTTPS.

## Instalar como aplicativo

O Cuidar+ é um PWA (aplicativo web progressivo). Em navegadores compatíveis, o botão **Instalar aplicativo** aparece na tela inicial assim que o navegador reconhece que a página pode ser instalada. Também é possível usar a opção **Instalar aplicativo** ou **Adicionar à tela inicial** do menu do navegador.

Para a instalação funcionar fora do ambiente local, publique o site em uma hospedagem com **HTTPS**. O `localhost` usado no desenvolvimento também é considerado seguro pelo navegador. Após a primeira visita, os arquivos básicos da tela inicial ficam disponíveis no cache para abertura sem conexão.

### Testar a instalação no Chrome Android

1. Publique o projeto em uma URL `https://` (a Vercel fornece HTTPS automaticamente).
2. Abra a URL publicada no **Google Chrome**, não no navegador interno de outro aplicativo.
3. Atualize a página uma vez e feche/abra novamente se ela já tiver sido visitada antes da atualização do service worker.
4. Aguarde o botão **Instalar aplicativo** aparecer ou abra o menu `⋮` do Chrome e procure **Instalar aplicativo**.
5. Depois de instalado, abra pelo ícone do Cuidar+. O botão não deve ser exibido no modo aplicativo.

O endereço de desenvolvimento da rede Wi-Fi (`http://192.168...`) serve apenas para visualizar a interface: ele não é seguro e, por isso, o Chrome Android não habilita a instalação PWA nele. Se o menu mostra apenas **Salvar página**, confirme que a URL começa com `https://`, que os ícones carregam e que o usuário não dispensou recentemente o prompt de instalação.

## Testar

```powershell
npm.cmd test
```

## Encontrar medicamentos em Cuiabá

A busca interna localiza **postos de saúde** e **unidades básicas de saúde** de Cuiabá no Cadastro Nacional de Estabelecimentos de Saúde (CNES), pela API aberta do Ministério da Saúde:

- endpoint: `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos`;
- município: código IBGE `510340` (Cuiabá); tipos `01` e `02`;
- campos exibidos somente quando presentes na fonte: nome, endereço, telefone, coordenadas e data de atualização do cadastro;
- cache no servidor: 6 horas, com possibilidade de servir a versão recente por até 24 horas enquanto atualiza.

Ao tocar em **Unidades perto de mim**, o navegador pede permissão para usar a localização apenas neste aparelho. Com consentimento, o app mostra unidades do CNES em até 10 km; sem consentimento, mostra a lista geral de Cuiabá. A localização não é enviada ao backend e a data nos cartões é a atualização do cadastro CNES, não uma atualização de estoque.

O portal municipal de estoque é mantido apenas como o botão externo **Consultar estoque oficial**. A página pública foi analisada, mas não foi localizada uma API pública documentada, exportação autorizada ou licença de reutilização para reproduzir seus dados internos no Cuidar+. Por isso o aplicativo não copia nem afirma disponibilidade, quantidade ou validade de medicamentos.

O mapa é criado somente após a busca, com Leaflet e blocos do OpenStreetMap, incluindo a atribuição exigida. Sem internet ou sem o mapa, a lista de unidades continua disponível quando a API puder ser consultada.

## Lembrete por voz (simulação)

Na opção **Simular ligação de lembrete**, o Cuidar+ usa apenas recursos do navegador: a mensagem é lida por síntese de voz e, ao terminar, o navegador pode pedir autorização para ouvir uma resposta curta. São aceitas as respostas “recebi”, “ouvi”, “sim”, “pode repetir”, “depois” e “não entendi”.

- o microfone fica ativo apenas durante até duas tentativas curtas; se não houver resposta válida, a simulação é encerrada sem confirmação;
- em navegador incompatível, com permissão negada ou sem microfone, os botões manuais continuam disponíveis;
- “Confirmar recebimento” registra somente que o aviso foi recebido — **não** marca a dose como tomada;
- para “depois”, a pessoa escolhe um novo horário na tela antes de adiar o lembrete;
- o histórico local separa lembrete enviado, chamada atendida, recebimento confirmado, adiamento, sem resposta e chamada encerrada.

Não há telefonia real, ligação para celular nem transmissão de áudio nesta etapa. A separação dos eventos no estado local permite que uma futura integração de telefonia registre os mesmos eventos, mediante autorização e infraestrutura apropriada.

## Incluído nesta etapa

- tela inicial responsiva com a identidade verde, cartões arredondados e o nome Cuidar+;
- destaque para o próximo lembrete de medicamento, identificado como demonstração;
- atalhos visuais para consultas, medicamentos, família e lembretes;
- botão de ajuda e aviso de que o recurso não substitui atendimento de emergência;
- controle de ampliação do texto e leitura do resumo via recurso nativo do navegador, quando disponível;
- ligação de lembrete simulada com síntese e reconhecimento de voz do navegador, alternativa por botões e histórico local de eventos;
- instalação como aplicativo web, com ícone, manifesto e modo de exibição sem a barra do navegador;
- cache offline dos arquivos básicos da tela inicial;
- busca interna de unidades públicas reais de Cuiabá pelo CNES, com telefone, rota e mapa quando a fonte fornecer esses dados;
- servidor local com a rota `/api/cuiaba-units` para testar a integração sem expor dados pessoais.

## Próximas etapas

Cadastro e histórico de medicamentos, tela de lembrete, simulação de ligação, painel do familiar e consultas seguem em evolução. Não há integração com dados de pacientes, nem confirmação de estoque de medicamento fora de uma fonte oficial autorizada.
