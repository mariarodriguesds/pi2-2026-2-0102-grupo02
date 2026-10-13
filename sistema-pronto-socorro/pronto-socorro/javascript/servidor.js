
var http = require('http');
var fs = require('fs');
var path = require('path');

// Verifica se as dependências foram instaladas na pasta do projeto
if (!fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
    console.error('Pasta node_modules não encontrada.');
    console.error('Execute npm.cmd install mysql2 na pasta Pronto Socorro.');
    process.exit(1);
}

// Verifica se existe o arquivo de configuração
if (!fs.existsSync(path.join(__dirname, 'config.js'))) {
    console.error('Arquivo config.js não encontrado.');
    console.error('Crie esse arquivo dentro da pasta JavaScript.');
    process.exit(1);
}

var mysql = require('mysql2/promise');
var config = require('./config');

// Conexão com o MySQL
var conexao = mysql.createPool(config.banco);

// Caminho da pasta principal do projeto
var PASTA_FRONT = path.join(__dirname, '..');

// Busca um paciente pelo CPF
async function buscarPacientePorCPF(cpf) {
    const sql = `
        SELECT
            id_paciente AS id,
            nome_completo AS nome,
            cpf AS cpf,
            data_nascimento AS dataNascimento
        FROM paciente
        WHERE cpf = ?
        LIMIT 1
    `;

    const [linhas] = await conexao.execute(sql, [cpf]);

    if (linhas.length === 0) {
        return null;
    }

    return linhas[0];
}

// Envia uma resposta em JSON
function responderJSON(res, status, dados) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(dados));
}

// Entrega os arquivos HTML, CSS e JavaScript
function enviarArquivo(res, caminho) {

    if (caminho === '/') {
        caminho = '/index.html';
    }

    var paginas = {
        '/index.html': 'index.html',
        '/recepcao.html': 'recepcao.html',
        '/paciente-nao-encontrado.html':
            'paciente-nao-encontrado.html',

        '/script.js': 'JavaScript/script.js',

        '/css/geral.css': 'css/geral.css',
        '/css/inicio.css': 'css/inicio.css',
        '/css/recepcao.css': 'css/recepcao.css'
    };

    if (!paginas[caminho]) {
        res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8'
        });

        res.end('404 Not Found');
        return;
    }

    var arquivo = path.join(PASTA_FRONT, paginas[caminho]);

    var tipos = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8'
    };

    fs.readFile(arquivo, function (err, data) {

        if (err) {
            res.writeHead(404, {
                'Content-Type': 'text/plain; charset=utf-8'
            });

            res.end('404 Not Found');
            return;
        }

        var extensao = path.extname(arquivo);

        res.writeHead(200, {
            'Content-Type': tipos[extensao] ||
                'application/octet-stream'
        });

        res.end(data);
    });
}

http.createServer(async function (req, res) {

    var caminho;

    // Trata endereços inválidos
    try {
        caminho = decodeURIComponent(req.url.split('?')[0]);
    } catch (erro) {
        res.writeHead(400, {
            'Content-Type': 'text/plain; charset=utf-8'
        });

        res.end('Endereço inválido');
        return;
    }

    // Consulta paciente pelo CPF
    if (
        req.method === 'GET' &&
        caminho.startsWith('/api/pacientes/')
    ) {

        var cpf = caminho.split('/')[3] || '';
        var cpfLimpo = cpf.replace(/\D/g, '');

        if (cpfLimpo.length !== 11) {
            responderJSON(res, 400, {
                mensagem: 'CPF inválido.'
            });

            return;
        }

        try {
            var paciente = await buscarPacientePorCPF(cpfLimpo);

            if (!paciente) {
                responderJSON(res, 404, {
                    mensagem: 'não encontrado',
                    redirecionarPara:
                        '/paciente-nao-encontrado.html'
                });

                return;
            }

            responderJSON(res, 200, {
                mensagem: 'Paciente encontrado.',
                paciente: paciente
            });

        } catch (erro) {
            console.error(
                'Erro ao consultar paciente:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao consultar paciente.'
            });
        }

        return;
    }

    // Entrega as páginas e os arquivos estáticos
    if (req.method === 'GET') {
        enviarArquivo(res, caminho);
        return;
    }

    res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
    });

    res.end('404 Not Found');

}).listen(config.porta, function () {
    console.log(
        'Servidor rodando em http://localhost:' + config.porta
    );
});
