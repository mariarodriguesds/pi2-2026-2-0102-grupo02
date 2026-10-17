# Sistema de Atendimentos de Pronto-Socorro

Sistema web para gerenciamento do atendimento em um pronto-socorro, permitindo o cadastro de pacientes, abertura e acompanhamento de atendimentos, realização da triagem, classificação de prioridade pelo Protocolo de Manchester e registro do atendimento médico.

## Integrantes

- Angelina Durigan
- Felipe Ribeiro Paulo
- Maria Fernanda Marques Rodrigues
- Ricardo Verissimo Borges
- Samantha Dell Vecchio Esteves
- Theo Monteiro Olino Noia Agunso

## Passo a passo de como subir o sistema em uma máquina limpa.

### 1. Tecnologias utilizadas

- **Front-end:** HTML, CSS e JavaScript.
- **Back-end:** Node.js.
- **Banco de dados:** MySQL.



### 2. Como obter o projeto

#### Opção 1 — Download pelo GitHub

Acesse o repositório do projeto no GitHub.

Clique em Code → Download ZIP.

Extraia o arquivo ZIP baixado.

Abra a pasta extraída e localize a pasta sistema-pronto-socorro.

#### Opção 2 — Clonar o repositório

Caso tenha o Git instalado, abra o terminal no local em que deseja salvar o projeto e execute:

```text
git clone URL_DO_REPOSITORIO
```

Substitua URL_DO_REPOSITORIO pela URL HTTPS do repositório no GitHub.

Após obter os arquivos, siga as etapas abaixo.

### 3. Pré-requisitos

Antes de executar o sistema, é necessário ter:

- Node.js instalado.
- MySQL instalado e em execução, diretamente ou por meio de uma ferramenta como o XAMPP.
- Uma ferramenta para administrar o banco de dados, como o MySQL Workbench ou o phpMyAdmin.

### 4. Configuração do banco de dados

- Inicie o serviço do MySQL.
- Abra o MySQL Workbench, o phpMyAdmin ou outra ferramenta compatível.
- Execute o script create.sql, localizado na pasta sistema-pronto-socorro, para criar a estrutura do banco de dados.
- Verifique se o banco de dados foi criado corretamente.

### 5. Configuração e execução

#### 5.1. Teste de conexão com o banco de dados

Essa etapa permite verificar se a conexão com o MySQL está funcionando.

Abra o terminal na pasta sistema-pronto-socorro/teste-conexao.

Instale as dependências:

```text
npm install
```

Crie o arquivo ```textconfig.js``` a partir do arquivo ```config.example.js```.

Abra o arquivo config.js e preencha as informações de conexão com o MySQL, conforme a configuração do seu ambiente.

Inicie o servidor:

```text
node servidor.js
```

Com o servidor em execução, acesse no navegador:

```text
http://localhost:3000/api/teste
```

Se necessário, consulte a mensagem retornada para verificar se a conexão foi estabelecida.

#### 5.2. Instalação das dependências do sistema

Abra outro terminal na pasta sistema-pronto-socorro/pronto-socorro.

Instale as dependências:

```text
npm install
```

#### 5.3. Configuração do sistema principal

Na pasta pronto-socorro/javascript, crie uma cópia do arquivo ```textconfig.example.js``` e nomeie-a como ```textonfig.js```.

Preencha o arquivo ```textconfig.js``` com as informações de conexão do seu banco de dados MySQL.

Importante: os arquivos config.js devem conter as configurações locais de cada ambiente. Não compartilhe nem envie esses arquivos ao GitHub quando contiverem senhas ou outras informações privadas.

#### 5.4. Execução do sistema principal

Certifique-se de que o servidor de teste, caso esteja em execução, foi encerrado com Ctrl + C.

Abra o terminal na pasta sistema-pronto-socorro/pronto-socorro.

Execute:

```
textnode javascript/servidor.js
```

Abra o navegador e acesse:

```text
http://localhost:3000
```


### 6. Estrutura do projeto

```text
sistema-pronto-socorro/
├── pronto-socorro/
│   ├── index.html
│   ├── recepcao.html
│   ├── paciente-nao-encontrado.html
│   ├── css/
│   │   ├── geral.css
│   │   ├── inicio.css
│   │   └── recepcao.css
│   ├── javascript/
│   │   ├── servidor.js
│   │   ├── script.js
│   │   ├── config.example.js
│   │   └── config.js (local, não versionado)
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
├── teste-conexao/
│   ├── .gitignore
│   ├── servidor.js
│   ├── servidor.example.js
│   └── config.js (local, não versionado)
└── create.sql
```



### 7. Observações

- O serviço do MySQL deve estar em execução para que o sistema possa acessar o banco de dados.
- As credenciais informadas nos arquivos ```textconfig.js``` devem corresponder às configurações do ambiente utilizado.
- O arquivo ```textconfig.js``` deve permanecer fora do versionamento para proteger as credenciais.
- Os dois servidores utilizam a porta 3000. Por isso, não devem ser executados simultaneamente na mesma porta.
- O arquivo ```textconfig.example.js``` deve permanecer no repositório para orientar a configuração em outros computadores.

