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



### 2. Pré-requisitos

Antes de executar o projeto, instale ou configure:

- **Node.js e npm:** para executar o back-end e instalar suas dependências.
- **MySQL Server ou uma ferramenta equivalente**, como o MySQL disponibilizado pelo XAMPP, para executar o banco de dados.
- **MySQL Workbench ou outra ferramenta de gerenciamento**, como phpMyAdmin, para administrar o banco de dados.

  

### 3. Configuração do banco de dados

#### 3.1. Iniciar o MySQL

Inicie o serviço do MySQL utilizando a ferramenta escolhida, como o XAMPP ou o MySQL Server.

#### 3.2. Criar o banco de dados e as tabelas

Execute o script de criação disponibilizado no arquivo `create.sql`, responsável pela criação do banco de dados e de suas tabelas.

Certifique-se de que o script seja executado no ambiente MySQL configurado para o projeto.



### 4. Configuração e execução do back-end

#### 4.1. Teste de conexão com o banco de dados

O projeto possui um back-end separado para testar a conexão com o banco de dados MySQL e verificar se é possível consultar uma tabela.

Para executar o teste:

1. Acesse a pasta `sistema-pronto-socorro/teste-conexao/`.
2. Instale as dependências com o comando `npm install`.
3. Configure o arquivo `config.js` com os dados de conexão com o MySQL, utilizando o arquivo de exemplo disponibilizado na pasta.
4. Inicie o servidor de teste com o comando `node servidor.js`.
5. Acesse a rota de teste configurada no servidor para verificar se a consulta ao banco de dados foi realizada com sucesso.

Se o teste retornar uma resposta indicando que foi possível ler a tabela, a conexão foi estabelecida e o back-end de teste conseguiu acessar o banco de dados.

Após concluir essa verificação, encerre o servidor de teste, caso ele utilize a mesma porta do sistema principal, e siga as instruções abaixo para executar a aplicação.

#### 4.2. Instalar as dependências do sistema principal

Acesse a pasta `sistema-pronto-socorro/pronto-socorro/` e execute:

```bash
npm install
```

#### 4.3. Configurar a conexão com o banco de dados

Na pasta `pronto-socorro/javascript/`, copie o arquivo `config.example.js` para `config.js` e preencha os dados de conexão com o MySQL da máquina.

No PowerShell, estando na pasta `pronto-socorro/`, execute:

```powershell
Copy-Item javascript/config.example.js javascript/config.js
```

O arquivo `config.js` contém configurações locais e não deve ser enviado ao GitHub.

#### 4.4. Iniciar o servidor principal

Ainda na pasta `pronto-socorro/`, execute:

```bash
node javascript/servidor.js
```

Com o servidor em execução, abra o navegador e acesse:

http://localhost:3000

As páginas HTML, os arquivos CSS e os scripts JavaScript são disponibilizados pelo servidor Node.js.



### 5. Executar o front-end

Com o servidor em execução, abra o navegador e acesse `http://localhost:3000`.

As páginas HTML, os arquivos CSS e os scripts JavaScript são disponibilizados pelo servidor Node.js.



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

- O serviço do MySQL deve estar em execução para que as operações com o banco de dados funcionem.
- Os dados de conexão devem corresponder à configuração local do MySQL.
- O arquivo `config.js` deve permanecer fora do versionamento para proteger as credenciais.
- O arquivo `config.example.js` deve ser mantido no repositório para orientar a configuração em outras máquinas.

