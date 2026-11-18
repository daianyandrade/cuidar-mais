# Cuidar+

Protótipo acadêmico instalável de uma interface de apoio à organização de lembretes de saúde para pessoas idosas. Esta primeira etapa implementa apenas a estrutura e a tela inicial, usando informações fictícias de demonstração.

## Executar

O projeto não requer instalação de pacotes. Com o Node.js instalado, execute no PowerShell:

```powershell
npm.cmd run start
```

Abra `http://localhost:4173` no navegador. Para usar outra porta, defina a variável `PORT` antes de iniciar o servidor.

### Abrir no celular durante o desenvolvimento

`localhost` funciona apenas no mesmo aparelho em que o servidor foi iniciado. Com o computador e o celular conectados à mesma rede Wi-Fi, inicie o projeto com `npm.cmd run start` e abra no celular o endereço **Cuidar+ disponível na rede Wi-Fi** mostrado no terminal, por exemplo `http://192.168.0.10:4173`.

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

## Incluído nesta etapa

- tela inicial responsiva, seguindo a identidade azul, verde e cartões arredondados da referência;
- destaque para o próximo lembrete de medicamento, identificado como demonstração;
- atalhos visuais para consultas, medicamentos, família e lembretes;
- botão de ajuda e aviso de que o recurso não substitui atendimento de emergência;
- controle de ampliação do texto e leitura do resumo via recurso nativo do navegador, quando disponível;
- instalação como aplicativo web, com ícone, manifesto e modo de exibição sem a barra do navegador;
- cache offline dos arquivos básicos da tela inicial;
- servidor local mínimo, sem integrações externas ou dados reais.

## Próximas etapas

Cadastro e histórico de medicamentos, tela de lembrete, simulação de ligação, painel do familiar, consultas e locais de atendimento serão implementados separadamente. Nenhuma integração com telefonia, mapas, SUS ou dados de pacientes está incluída neste protótipo.
