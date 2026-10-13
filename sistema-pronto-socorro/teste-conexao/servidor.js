// Back-end do Sistema de Atendimentos de Pronto Socorro
// H01.3: projeto ligado ao banco, com uma operação de teste que lê uma tabela.
//
// Para rodar:
//   1. npm install
//   2. copiar config.example.js para config.js e colocar a senha do MySQL
//   3. npm start
//   4. abrir http://localhost:3000/api/teste

var http = require('http');
var fs = require('fs');
var path = require('path');

// Checagens antes de começar, com mensagem clara do que falta
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.error('Pasta node_modules não encontrada. Rode "npm install" dentro da pasta backend.');
    process.exit(1);
}

// Os dados do banco ficam no config.js (cada um cria o seu)
if (!fs.existsSync(path.join(__dirname, 'config.js'))) {
    console.error('Arquivo config.js não encontrado.');
    console.error('Crie o config.js copiando o config.example.js e coloque os dados do seu MySQL.');
    process.exit(1);
}

var mysql = require('mysql2/promise');
var config = require('./config');

// Conexão com o MySQL (os dados vêm do config.js)
var conexao = mysql.createPool(config.banco);

// Tabela lida na operação de teste. Se o nome mudar no script do banco, trocar só aqui.
var TABELA_TESTE = 'paciente';

// Pasta com as páginas do front-end (index.html etc.)
var PASTA_FRONT = path.join(__dirname, '..', 'frontend');

// Envia uma resposta em JSON
function responderJSON(res, status, dados) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(dados));
}

// Operação de teste: conta quantos registros existem na tabela
async function testarBanco(res) {
    try {
        var [linhas] = await conexao.execute(
            'SELECT COUNT(*) AS total FROM ' + TABELA_TESTE
        );

        responderJSON(res, 200, {
            mensagem: 'Back-end funcionando e lendo o banco.',
            tabela: TABELA_TESTE,
            totalDeRegistros: linhas[0].total
        });

    } catch (erro) {
        console.error('Erro ao ler o banco:', erro.message);

        responderJSON(res, 500, {
            mensagem: 'Back-end funcionando, mas não conseguiu ler o banco.',
            erro: erro.message
        });
    }
}

// Entrega os arquivos do front-end (html, css, js)
function enviarArquivo(res, caminho) {
    if (caminho === '/') {
        caminho = '/index.html';
    }

    var arquivo = path.join(PASTA_FRONT, path.normalize(caminho));

    // Impede pedir arquivos de fora da pasta do front (ex.: /../config.js)
    if (!arquivo.startsWith(PASTA_FRONT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Acesso negado');
        return;
    }

    var tipos = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    fs.readFile(arquivo, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        var extensao = path.extname(arquivo);

        res.writeHead(200, {
            'Content-Type': tipos[extensao] || 'application/octet-stream'
        });
        res.end(data);
    });
}

http.createServer(function (req, res) {

    var caminho;

    // Endereço mal escrito (ex.: com % sobrando) não pode derrubar o servidor
    try {
        caminho = decodeURIComponent(req.url.split('?')[0]);
    } catch (erro) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Endereço inválido');
        return;
    }

    if (req.method === 'GET' && caminho === '/api/teste') {
        testarBanco(res);
        return;
    }

    if (req.method === 'GET') {
        enviarArquivo(res, caminho);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');

}).listen(config.porta, function () {
    console.log('Servidor rodando em http://localhost:' + config.porta);
    console.log('Teste do banco: http://localhost:' + config.porta + '/api/teste');
});
