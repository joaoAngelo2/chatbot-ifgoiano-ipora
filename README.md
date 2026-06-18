# Bot WhatsApp - IFGoiano Campus Iporá

Chatbot para WhatsApp que informa estudantes do IFGoiano Campus Iporá sobre notícias e comunicados do campus. O bot monitora periodicamente o site institucional, armazena as notícias em um banco de dados e responde perguntas dos usuários usando busca semântica (embeddings) combinada com um modelo de linguagem.

## Visão geral do funcionamento

O sistema é dividido em três frentes que rodam em conjunto a partir de um único processo Node.js:

1. Scraper: a cada hora, busca as notícias mais recentes publicadas no site do IFGoiano Campus Iporá, gera um embedding semântico de cada notícia nova e salva no banco de dados. Usuários cadastrados para notificações recebem a notícia automaticamente por WhatsApp.
2. Bot do WhatsApp: usa a biblioteca Baileys para se conectar ao WhatsApp Web. Na primeira execução, gera um QR Code (exibido em uma página local) para autenticação. Depois de autenticado, escuta mensagens recebidas, identifica novos usuários (perguntando se desejam receber notificações) e responde perguntas com base nas notícias mais relevantes.
3. Camada de IA: ao receber uma pergunta, o sistema gera um embedding da pergunta, compara por similaridade de cosseno com os embeddings das notícias salvas e seleciona a mais relevante (acima de um limiar de similaridade). Esse contexto, junto do histórico recente da conversa, é enviado a um modelo de linguagem (via API da Groq) que formula a resposta em tom de conversa de WhatsApp.

## Arquitetura de pastas

```
bot_whatsapp/
├── server.js              Ponto de entrada da aplicação
├── scraper.js              Rotina de coleta de noticias do site do IFGoiano
├── package.json            Dependencias e script de inicializacao
├── .env                    Variaveis de ambiente (nao versionado)
├── .gitignore
│
├── src/
│   ├── bot/
│   │   └── Bot.js          Conexao com o WhatsApp (Baileys), QR Code, roteamento de mensagens
│   │
│   ├── ai/
│   │   └── Ai.js           Geracao de embeddings, calculo de similaridade e chamada ao LLM
│   │
│   ├── database/
│   │   └── Database.js     Acesso ao MySQL (usuarios e noticias)
│   │
│   └── models/
│       ├── Noticia.js       Modelo de dominio de uma noticia
│       └── Usuario.js       Modelo de dominio de um usuario
│
└── auth/                    Credenciais de sessao do WhatsApp geradas pelo Baileys (nao versionado)
```

### Descrição dos módulos

server.js inicializa o agendamento do scraper (executa uma vez ao iniciar e depois a cada hora) e inicia a conexão do bot com o WhatsApp.

scraper.js acessa a página de últimas notícias do campus, extrai título, data, texto e link de cada notícia nova, gera o embedding via Ai.js e persiste via Database.js. Notícias novas disparam notificação para os usuários cadastrados.

src/bot/Bot.js concentra toda a lógica de interação com o WhatsApp: abre a conexão usando Baileys, mantém um pequeno servidor HTTP na porta 3000 para exibir o QR Code de pareamento, evita reprocessar mensagens duplicadas, conduz o fluxo de opt-in de notificações para novos usuários e mantém um histórico curto de conversa por usuário (limpo após 30 minutos de inatividade) para dar contexto às respostas.

src/ai/Ai.js é responsável por três coisas: gerar embeddings de texto (modelo gemini-embedding-001, via API do Google), calcular a similaridade de cosseno entre dois embeddings, e gerar a resposta final em linguagem natural enviando o contexto da notícia mais relevante e o histórico de conversa para um modelo hospedado na Groq.

src/database/Database.js encapsula todas as queries ao MySQL, usando um pool de conexões. Mantém duas tabelas: usuario (número de WhatsApp e preferência de notificações) e noticias (conteúdo da notícia e seu embedding serializado).

src/models contém apenas classes simples de domínio (Noticia e Usuario) usadas para padronizar os dados que circulam entre o banco, o scraper e o bot.

auth/ é gerada automaticamente pelo Baileys na primeira autenticação (escaneamento do QR Code) e contém as chaves de criptografia e o estado da sessão do WhatsApp. Por ser informação sensível e específica de cada número conectado, está no .gitignore e nunca deve ser commitada ou compartilhada.

## Tecnologias utilizadas

Node.js (modo ES Modules) é a base do projeto. A conexão com o WhatsApp é feita com a biblioteca Baileys (@whiskeysockets/baileys). O banco de dados é MySQL, acessado via mysql2. A geração de embeddings usa a API do Google Gemini (@google/genai) e a geração das respostas em linguagem natural usa a API da Groq, consumida via fetch direto. O scraping do site institucional é feito com cheerio. QR Code de pareamento é gerado com as bibliotecas qrcode e qrcode-terminal.

## Pré-requisitos

Antes de reproduzir o projeto, é necessário ter:

Node.js na versão 20 ou superior instalado. Um servidor MySQL acessível (local ou remoto). Uma conta no WhatsApp disponível para ser usada como número do bot (recomenda-se usar um número dedicado, não o principal). Uma chave de API da Groq (console.groq.com). Uma chave de API do Google AI Studio para o modelo de embeddings do Gemini (aistudio.google.com).

## Como reproduzir o projeto

### 1. Clonar o repositório e instalar dependências

```
git clone https://github.com/joaoAngelo2/chatbot-ifgoiano-ipora
cd bot_whatsapp
npm install
```

### 2. Configurar o banco de dados

Crie um banco de dados MySQL e as tabelas usadas pela aplicação:

```sql
CREATE DATABASE ifgoiano_bot;

USE ifgoiano_bot;

CREATE TABLE usuario (
  whatsapp VARCHAR(20) PRIMARY KEY,
  notificacoes BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE noticias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  link VARCHAR(500) NOT NULL,
  data_noticia DATE NOT NULL,
  noticia TEXT NOT NULL,
  embedding TEXT NOT NULL
);
```

Observação: a coluna embedding armazena o vetor gerado pelo Gemini serializado como JSON (texto). O esquema acima é o mínimo necessário a partir do que o código em Database.js consulta; ajuste tipos e tamanhos de coluna conforme a necessidade real do seu ambiente.

### 3. Criar o arquivo de variáveis de ambiente

Crie um arquivo .env na raiz do projeto com o seguinte conteúdo:

```
GROQ_API_KEY=sua_chave_da_groq
GEMINI_API_KEY=sua_chave_do_google_gemini
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=ifgoiano_bot
```

### 4. Iniciar a aplicação

```
npm start
```

Isso executa server.js, que dispara a primeira coleta de notícias e inicia a conexão com o WhatsApp.

### 5. Conectar o número do WhatsApp

Na primeira execução, abra http://localhost:3000 no navegador. A página exibirá um QR Code (atualizado automaticamente a cada poucos segundos). Escaneie esse código com o aplicativo do WhatsApp que será usado como bot, em Aparelhos conectados.

Após a leitura, a sessão é autenticada e os dados de autenticação ficam salvos na pasta auth/, que é criada automaticamente. Nas próximas execuções, enquanto essa pasta existir e a sessão continuar válida, não será necessário escanear o QR Code novamente.

### 6. Testar o bot

Envie uma mensagem para o número conectado a partir de outro WhatsApp. No primeiro contato, o bot perguntará se o usuário deseja receber notificações de novas notícias (responder 1 para sim ou 2 para não). A partir daí, é possível enviar perguntas relacionadas às notícias do campus e o bot responderá com base na notícia mais relevante encontrada no banco de dados.
