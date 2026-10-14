# Despacha Fácil[cite: 20]

Aplicação web e API desenvolvida em **JavaScript (Node.js/Next.js)** e **PostgreSQL**, estruturada sob princípios de testes contínuos, automação de infraestrutura via Docker e padronização estrita de código[cite: 20].

---

## 🛠️ Tecnologias Utilizadas

- **Runtime & Framework:** Node.js, Next.js e React (JavaScript ES6+)[cite: 20].
- **Banco de Dados & Infra:** PostgreSQL, Docker e Docker Compose[cite: 20].
- **Qualidade & Testes:** Jest (testes de integração com orquestrador próprio), ESLint e Prettier[cite: 20].
- **Controle de Versão & CI:** Git, Husky (hooks de validação e pre-commit), Commitlint (Conventional Commits) e GitHub Actions[cite: 20].

---

## 📁 Estrutura do Projeto

```text
├── .github/workflows/      # Pipelines de CI (linting e testes automatizados)
├── .husky/                 # Git hooks para commitlint e execução de testes
├── infra/
│   ├── compose.yaml        # Definição dos containers do banco de dados
│   ├── database.js         # Camada de conexão e queries do PostgreSQL
│   ├── migrations/         # Arquivos de migração de schema do banco
│   └── scripts/            # Scripts utilitários (espera do banco, códigos de saída)
├── pages/
│   ├── api/v1/
│   │   ├── migrations/     # Endpoint REST para consultar e rodar migrations
│   │   └── status/         # Endpoint de diagnóstico da aplicação e banco
│   └── status/             # Interface visual da página de status
├── tests/
│   ├── integration/        # Testes de integração cobrindo fluxos reais de API
│   └── orchestrator.js     # Utilitário para aguardar banco e serviços antes dos testes
```

[cite: 20]

---

## 🚀 Começando

### Pré-requisitos

- **Node.js** (versão especificada no `.nvmrc`)[cite: 20].
- **Docker** e **Docker Compose**[cite: 20].
- **Git**[cite: 20].

### 1. Clonar o repositório

```bash
git clone https://github.com/igorantunes66/despachafacil.git
cd despachafacil
```

[cite: 20]

### 2. Configurar variáveis de ambiente

Crie o arquivo de ambiente local com base nas configurações de desenvolvimento[cite: 20]:

```bash
cp .env.development .env.local
```

[cite: 20]

### 3. Instalar dependências

```bash
npm install
```

[cite: 20]

### 4. Inicializar os serviços (Banco de Dados)

Suba os containers do PostgreSQL via Docker Compose[cite: 20]:

```bash
docker compose -f infra/compose.yaml up -d
```

[cite: 20]

### 5. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

[cite: 20]
Acesse a aplicação em `http://localhost:3000`[cite: 20].

---

## 📡 Endpoints da API

| Método | Endpoint             | Descrição                                                                                   |
| ------ | -------------------- | ------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/status`     | Retorna o status operacional do servidor, versão do PostgreSQL e conexões ativas[cite: 20]. |
| `GET`  | `/api/v1/migrations` | Lista as migrações pendentes no PostgreSQL[cite: 20].                                       |
| `POST` | `/api/v1/migrations` | Executa as migrações pendentes no banco de dados[cite: 20].                                 |

---

## 🧪 Testes e Qualidade de Código

- **Executar suíte de testes:** O Jest executa os testes de integração após o `tests/orchestrator.js` confirmar que o PostgreSQL está pronto para aceitar conexões[cite: 20].
  ```bash
  npm test
  ```

[cite: 20]

- **Verificação de código e formatação:** Valida as regras do ESLint e do Prettier.
  ```bash
  npm run lint:eslint:check
  npm run lint:prettier:check
  ```

[cite: 20]

- **Padrão de commits:** O projeto força o padrão Conventional Commits validado via Husky e Commitlint antes de cada confirmação[cite: 20].

---

## 📄 Licença

Este projeto está sob a licença definida no arquivo [LICENSE](LICENSE)[cite: 20].

## E-mail em desenvolvimento

O MailCatcher sobe junto com o PostgreSQL em `npm run services:up` e captura os
e-mails enviados localmente. A caixa de entrada fica disponível em
http://127.0.0.1:1080, e o servidor SMTP escuta na porta 1025. As duas portas são
publicadas apenas na interface local da máquina.

As configurações locais estão em `.env.development`:

| Variável            | Uso                                                                |
| ------------------- | ------------------------------------------------------------------ |
| `EMAIL_SMTP_HOST`   | Endereço do servidor SMTP                                          |
| `EMAIL_SMTP_PORT`   | Porta SMTP                                                         |
| `EMAIL_SMTP_SECURE` | `true` para TLS desde o início da conexão, geralmente na porta 465 |
| `EMAIL_FROM`        | Remetente das mensagens                                            |
| `EMAIL_HTTP_URL`    | Endereço da interface/API do MailCatcher, usado nos testes         |

Para um provedor real, configure também `EMAIL_SMTP_USER` e
`EMAIL_SMTP_PASSWORD` no ambiente de implantação. Em produção, o módulo exige
TLS: na porta 587, use `EMAIL_SMTP_SECURE=false` para a negociação STARTTLS;
na porta 465, use `EMAIL_SMTP_SECURE=true`. Credenciais reais não devem ser
salvas nos arquivos versionados.

O módulo `infra/email.js` envia mensagens com texto e, opcionalmente, HTML:

```javascript
import email from "infra/email";

await email.send({
  to: "cliente@example.test",
  subject: "Recebemos sua solicitação",
  text: "Em breve nossa equipe entrará em contato.",
  html: "<p>Em breve nossa equipe entrará em contato.</p>",
});
```

O retorno confirma a aceitação pelo servidor SMTP, não a entrega na caixa de
entrada do destinatário. Falhas são propagadas ao chamador. Não há reenvio
automático nesta etapa.

Os testes de integração em `tests/integration/infra/email.test.js` usam o
orchestrator para aguardar SMTP e HTTP, limpar a caixa no início da suíte e
consultar a última mensagem com texto e HTML. Eles também exercitam uma falha SMTP.
Execute a suíte com `npm test`; o encerramento dos serviços inclui o MailCatcher.

Para inspecionar as mensagens após os testes, mantenha `npm run dev` em um
terminal e execute `npm run test:watch` em outro. As mensagens permanecem
disponíveis até a próxima execução da suíte de e-mail ou até o MailCatcher ser
reiniciado, pois sua caixa de entrada é armazenada em memória.

## Testes após o deploy na Vercel

O workflow `Deployed API Tests` aguarda um evento `deployment_status` de sucesso
criado pela integração da Vercel. Ele testa a URL daquele deploy e publica um
status no commit correspondente:

- `Smoke / Preview`: verificação da homologação, usada para bloquear o merge.
- `Smoke / Production`: verificação após a publicação em produção.

A suíte `tests/smoke/` usa Jest e HTTP, com configuração independente do Next.js,
sem carregar `.env.development`, acessar diretamente o banco ou usar o
orchestrator local. Atualmente verifica `GET` e `HEAD /api/v1/status`, incluindo
formato da resposta, atualização recente, informações válidas do PostgreSQL e
disponibilidade do SMTP.
Não exige a versão ou a quantidade de conexões do ambiente local.

Essas verificações detectam falhas na API de status, no acesso ao banco e na
conexão SMTP. Não comprovam o funcionamento de cadastro, entrega de e-mail ou fluxos que ainda não estão
cobertos. A suíte completa continua rodando no CI; novos fluxos publicados devem
ganhar testes de homologação conforme forem implementados.

### Ativação no GitHub e na Vercel

1. Publique estes arquivos na branch padrão. A automação executa a versão dos
   testes dessa branch, para que código de previews não tenha acesso ao segredo
   de bypass. Mudanças nos smoke tests passam a valer depois do merge.
2. Se o preview tiver Deployment Protection, crie um segredo em **Vercel →
   Project Settings → Deployment Protection → Protection Bypass for Automation**.
   Salve o valor no GitHub em **Settings → Secrets and variables → Actions**, com
   o nome `VERCEL_AUTOMATION_BYPASS_SECRET`. Não é um token de acesso à conta
   Vercel. Para deploys públicos, esse segredo é opcional.
3. Faça um novo deploy de preview e confirme o resultado `Smoke / Preview` no
   commit do PR. O workflow usa o SHA do deploy, não o último commit de `main`.
4. Na regra de proteção/ruleset da `main`, mantenha os checks existentes e
   acrescente **`Smoke / Preview` como obrigatório antes do merge**. Ative também
   a exigência de branch atualizada. Não marque o job
   `Verify Vercel deployment` como obrigatório: ele pode ser ignorado enquanto
   o deploy ainda não terminou. Restrinja bypass da regra conforme a política da
   equipe. Configure essa exigência somente após ativar e verificar a automação,
   para não bloquear o PR inicial que a introduz.
5. Confira as preferências de notificações de falhas do GitHub Actions para as
   pessoas responsáveis. O workflow fica vermelho em uma falha e fornece logs,
   resumo e o artefato `smoke-...`, disponível por sete dias. Ele não envia
   mensagens para Slack/e-mail nem faz rollback automaticamente.

O teste de produção acontece **após** o deploy e verifica sua URL específica.
Ele não bloqueia a publicação nem verifica automaticamente um domínio próprio,
seus redirects ou problemas que apareçam horas depois. Monitoramento periódico
pode ser acrescentado em outra etapa.

### Executar manualmente

Com o servidor local já aberto:

```bash
TEST_BASE_URL=http://localhost:3000 npm run test:smoke
```

Para um ambiente publicado, forneça sua origem HTTPS em `TEST_BASE_URL` e, se
necessário, injete `VERCEL_AUTOMATION_BYPASS_SECRET` no ambiente de execução.
Não há URL padrão: esquecer a configuração faz o teste falhar. As requisições
aceitam apenas GET/HEAD e não seguem redirects, evitando enviar o segredo de
bypass para outro destino. Uma página de login, redirect, erro HTTP, timeout ou
resposta fora do contrato faz a execução falhar.

Os smoke tests ficam fora de `npm test` e `npm run test:watch`. Eles não executam
migrations nem limpam dados de homologação ou produção. Antes de adicionar testes
com escrita em homologação, confirme que o banco de preview está separado do
banco de produção e reserve dados exclusivos para a automação.

### E-mail no diagnóstico de status

`GET /api/v1/status` inclui `dependencies.email.connected`. A verificação usa
`infra/email.verifyConnection()` e não envia mensagens: confirma a conexão SMTP,
TLS e autenticação quando configurados, mas não garante a entrega ao destinatário
nem que o provedor aceitará o remetente.

Com o SMTP disponível, a API responde 200. Se a verificação SMTP falhar,
responde 503, com `connected: false`, preservando as informações do banco e sem
expor credenciais ou detalhes do servidor SMTP. Falhas do banco continuam seguindo
o tratamento de erro interno existente.

Antes de publicar essa alteração, configure o provedor SMTP real na Vercel para
**Preview** e **Production**, usando as variáveis de e-mail descritas acima.
Sem essa configuração, os testes remotos indicarão indisponibilidade.

### Página de status e MailCatcher local

`/status` apresenta os dados do banco, a disponibilidade SMTP e a última
atualização. A consulta é compartilhada entre as seções e se repete a cada
30 segundos. Falhas de conexão são exibidas sem perder os demais diagnósticos.

No ambiente local, quando `EMAIL_HTTP_URL` está configurada, a API também inclui
`dependencies.mailcatcher`: disponibilidade HTTP, URL da caixa de entrada e
quantidade de mensagens capturadas. A consulta usa apenas `GET /messages`.
Essa dependência é omitida em produção, inclusive nos previews da Vercel.

O MailCatcher usado localmente não informa sua versão nessa API; o campo
`version` fica `null` e a página exibe “Não informada pelo serviço”. Se sua
interface HTTP falhar, a API local retorna 503, mesmo se o SMTP estiver disponível.
