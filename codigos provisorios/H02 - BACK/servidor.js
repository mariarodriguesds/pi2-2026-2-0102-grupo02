
var http = require('http');
var fs = require('fs');
var path = require('path');
var mysql = require('mysql2/promise');

var conexao = mysql.createPool({
    host: '[HOST DO BANCO DE DADOS]',
    user: '[USUARIO DO BANCO]',
    password: '[SENHA DO BANCO]',
    database: '[NOME DO BANCO DE DADOS]'
});

async function buscarPacientePorCPF(cpf) {

    const sql = `
        SELECT
            [CAMPO_NOME] AS nome,
            [CAMPO_CPF] AS cpf,
            [CAMPO_DATA_NASCIMENTO] AS dataNascimento
        FROM [NOME_DA_TABELA_DE_PACIENTES]
        WHERE [CAMPO_CPF] = ?
        LIMIT 1
    `;

    const [linhas] = await conexao.execute(sql, [cpf]);

    if (linhas.length === 0) {
        return null;
    }

    return linhas[0];
}

http.createServer(async function (req, res) {

    var caminho = decodeURIComponent(
        req.url.split('?')[0]
    );

    if (
        req.method === 'GET' &&
        caminho.startsWith('/api/pacientes/')
    ) {

        var cpf = caminho.split('/')[3] || '';
        var cpfLimpo = cpf.replace(/\D/g, '');

        if (cpfLimpo.length !== 11) {
            res.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8'
            });

            res.end(JSON.stringify({
                mensagem: 'CPF inválido.'
            }));

            return;
        }

        try {
            var paciente = await buscarPacientePorCPF(cpfLimpo);

            if (!paciente) {
                res.writeHead(404, {
                    'Content-Type': 'application/json; charset=utf-8'
                });

                res.end(JSON.stringify({
                    mensagem: 'não encontrado',
                    redirecionarPara: '/paciente-nao-encontrado.html'
                }));

                return;
            }

            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });

            res.end(JSON.stringify({
                mensagem: 'Paciente encontrado.',
                paciente: paciente
            }));

        } catch (erro) {
            console.error('Erro ao consultar paciente:', erro.message);

            res.writeHead(500, {
                'Content-Type': 'application/json; charset=utf-8'
            });

            res.end(JSON.stringify({
                mensagem: 'Erro ao consultar paciente.'
            }));
        }

        return;
    }

    var paginas = {
        '/': 'index.html',
        '/index.html': 'index.html',
        '/script.js': 'script.js',
        '/paciente-nao-encontrado.html':
            'paciente-nao-encontrado.html',
        '/cadastro-paciente.html':
            'cadastro-paciente.html'
    };

    if (req.method === 'GET' && paginas[caminho]) {

        var arquivo = path.join(
            __dirname,
            paginas[caminho]
        );

        fs.readFile(arquivo, function (err, data) {

            if (err) {
                res.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8'
                });

                res.end('404 Not Found');
                return;
            }

            var extensao = path.extname(arquivo);

            var tipos = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8'
            };

            res.writeHead(200, {
                'Content-Type': tipos[extensao] ||
                    'application/octet-stream'
            });

            res.end(data);
        });

        return;
    }

    res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
    });

    res.end('404 Not Found');

}).listen(3000, function () {
    console.log('Servidor rodando em http://localhost:3000');
});
