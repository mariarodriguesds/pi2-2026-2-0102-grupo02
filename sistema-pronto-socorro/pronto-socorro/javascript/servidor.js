
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

// H05.1 - Abre um atendimento para o paciente
// O número (AT0001, AT0002...) é gerado aqui, nunca digitado.
// A data e hora de chegada são gravadas com NOW() do MySQL.
// Se o número já existir, o UNIQUE do banco recusa e dá erro.
async function abrirAtendimento(idPaciente) {

    // Pega o maior id e soma 1 para montar o próximo número
    const [ultimo] = await conexao.execute(
        'SELECT MAX(id_atendimento) AS maior FROM atendimento'
    );

    var proximo = 1;

    if (ultimo[0].maior) {
        proximo = ultimo[0].maior + 1;
    }

    // Completa com zeros: 1 vira AT0001
    var numero = 'AT' + String(proximo).padStart(4, '0');

    await conexao.execute(
        `INSERT INTO atendimento
            (numero_atendimento, id_paciente, data_hora_chegada, status)
         VALUES (?, ?, NOW(), ?)`,
        [numero, idPaciente, 'AGUARDANDO_TRIAGEM']
    );

    return numero;
}

// H06.1 - Busca atendimentos pelo número (AT0001) ou pelo CPF do paciente
async function buscarAtendimentos(numeroOuCpf) {
    var sql = `
        SELECT
            a.numero_atendimento AS numero,
            a.data_hora_chegada AS dataHoraChegada,
            a.status AS status,
            p.id_paciente AS idPaciente,
            p.nome_completo AS nome,
            p.cpf AS cpf
        FROM atendimento a
        JOIN paciente p ON p.id_paciente = a.id_paciente
    `;

    var valor;

    if (/^AT\d+$/i.test(numeroOuCpf)) {
        sql += ' WHERE a.numero_atendimento = ?';
        valor = numeroOuCpf.toUpperCase();
    } else {
        sql += ' WHERE p.cpf = ?';
        valor = numeroOuCpf.replace(/\D/g, '');
    }

    // Um paciente pode ter vários atendimentos: o mais recente primeiro
    sql += ' ORDER BY a.data_hora_chegada DESC';

    const [linhas] = await conexao.execute(sql, [valor]);

    return linhas;
}


// H07.1 - Lista atendimentos aguardando triagem
async function listarAtendimentosAguardandoTriagem() {
    const sql = `
        SELECT
            a.numero_atendimento AS numero,
            a.data_hora_chegada AS dataHoraChegada,
            a.status AS status,
            p.id_paciente AS idPaciente,
            p.nome_completo AS nome,
            p.cpf AS cpf
        FROM atendimento a
        JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE a.status = 'AGUARDANDO_TRIAGEM'
        ORDER BY a.numero_atendimento ASC
    `;

    const [linhas] = await conexao.execute(sql);

    return linhas;
}


// Lê o corpo (JSON) enviado pelo front
function lerCorpo(req) {
    return new Promise(function (resolve, reject) {
        var corpo = '';

        req.on('data', function (parte) {
            corpo += parte;
        });

        req.on('end', function () {
            try {
                resolve(JSON.parse(corpo || '{}'));
            } catch (erro) {
                reject(erro);
            }
        });

        req.on('error', reject);
    });
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
        '/cadastro-paciente.html': 'cadastro-paciente.html',
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
        caminho.startsWith('/api/paciente/')
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

    // H05.1 - Abre atendimento
    // Corpo esperado: { "idPaciente": 1 }
    if (
        req.method === 'POST' &&
        caminho === '/api/atendimentos'
    ) {

        var dados;

        try {
            dados = await lerCorpo(req);
        } catch (erro) {
            responderJSON(res, 400, {
                mensagem: 'Dados inválidos.'
            });

            return;
        }

        var idPaciente = Number(dados.idPaciente);

        if (!idPaciente || idPaciente <= 0) {
            responderJSON(res, 400, {
                mensagem: 'Informe o paciente do atendimento.'
            });

            return;
        }

        try {
            const [paciente] = await conexao.execute(
                'SELECT id_paciente FROM paciente WHERE id_paciente = ?',
                [idPaciente]
            );

            if (paciente.length === 0) {
                responderJSON(res, 404, {
                    mensagem: 'Paciente não encontrado.'
                });

                return;
            }

            var numero = await abrirAtendimento(idPaciente);

            responderJSON(res, 201, {
                mensagem: 'Atendimento aberto.',
                numero: numero
            });

        } catch (erro) {
            console.error(
                'Erro ao abrir atendimento:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao abrir atendimento.'
            });
        }

        return;
    }

    // Listar atendimentos aguardando triagem
    if (
        req.method === "GET" &&
        caminho === "/api/atendimentos/aguardando-triagem"
    ) {
        try {
            const atendimentos = await listarAtendimentosAguardandoTriagem();

            responderJSON(res, 200, {
                mensagem: "Atendimentos aguardando triagem.",
                atendimentos
            });

        } catch (erro) {
            console.error("Erro ao listar atendimentos:", erro);

            responderJSON(res, 500, {
                mensagem: "Erro ao listar atendimentos aguardando triagem."
            });
        }

        return;
    }

    // H06.1 - Consulta atendimento pelo número ou pelo CPF
    // Exemplos: /api/atendimentos/AT0001  ou  /api/atendimentos/12345678901
    if (
        req.method === 'GET' &&
        caminho.startsWith('/api/atendimentos/')
    ) {

        var busca = (caminho.split('/')[3] || '').trim();
        var ehNumero = /^AT\d+$/i.test(busca);
        var ehCpf = busca.replace(/\D/g, '').length === 11;

        if (!ehNumero && !ehCpf) {
            responderJSON(res, 400, {
                mensagem: 'Informe o número do atendimento (ex: AT0001) ou um CPF com 11 dígitos.'
            });

            return;
        }

        try {
            var atendimentos = await buscarAtendimentos(busca);

            if (atendimentos.length === 0) {
                responderJSON(res, 404, {
                    mensagem: 'Nenhum atendimento encontrado.'
                });

                return;
            }

            responderJSON(res, 200, {
                mensagem: 'Atendimento encontrado.',
                atendimentos: atendimentos
            });

        } catch (erro) {
            console.error(
                'Erro ao consultar atendimento:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao consultar atendimento.'
            });
        }

        return;
    }

    if (req.method === "POST" &&
        caminho === "/api/paciente") {

        try {

            var dados = await lerCorpo(req);

            var nome = String(
                dados.nome_completo || ""
            ).trim();

            var cpf = String(
                dados.cpf || ""
            ).replace(/\D/g, "");

            var rg = dados.rg
                ? String(dados.rg).trim() || null
                : null;

            var nascimento = dados.data_nascimento || null;

            var pai = dados.nome_pai
                ? String(dados.nome_pai).trim() || null
                : null;

            var mae = dados.nome_mae
                ? String(dados.nome_mae).trim() || null
                : null;

            var enderecoPaciente = dados.endereco
                ? String(dados.endereco).trim() || null
                : null;

            var telefone = String(
                dados.telefone || ""
            ).replace(/\D/g, "");

            if (!nome || !cpf) {
                responderJSON(res, 400, {
                    mensagem: "Informe o nome completo e o CPF."
                });
                return;
            }

            if (nome.length > 150) {
                responderJSON(res, 400, {
                    mensagem: "O nome deve ter no máximo 150 caracteres."
                });
                return;
            }

            if (!/^\d{11}$/.test(cpf)) {
                responderJSON(res, 400, {
                    mensagem: "Informe um CPF com 11 dígitos."
                });
                return;
            }

            if (nascimento) {
                var data = new Date(nascimento + "T00:00:00Z");

                var hoje = new Date();
                var dataAtual = new Date(Date.UTC(
                    hoje.getFullYear(),
                    hoje.getMonth(),
                    hoje.getDate()
                ));

                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(nascimento) ||
                    isNaN(data.getTime()) ||
                    data.toISOString().slice(0, 10) !== nascimento ||
                    data > dataAtual
                ) {
                    responderJSON(res, 400, {
                        mensagem: "Informe uma data de nascimento válida."
                    });
                    return;
                }
            }

            if (telefone && !/^\d{10,11}$/.test(telefone)) {
                responderJSON(res, 400, {
                    mensagem: "Informe um telefone com DDD válido."
                });
                return;
            }

            var resultado = await conexao.execute(
                "SELECT cpf FROM paciente WHERE cpf = ? LIMIT 1",
                [cpf]
            );

            if (resultado[0].length > 0) {
                responderJSON(res, 409, {
                    mensagem: "CPF já cadastrado."
                });
                return;
            }

            await conexao.execute(
                `INSERT INTO paciente
                (nome_completo, cpf, rg, data_nascimento,
                 nome_pai, nome_mae, endereco, telefone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nome,
                    cpf,
                    rg,
                    nascimento,
                    pai,
                    mae,
                    enderecoPaciente,
                    telefone || null
                ]
            );

            responderJSON(res, 201, {
                mensagem: "Paciente cadastrado com sucesso."
            });

        } catch (erro) {
            console.error("Erro ao cadastrar paciente:", erro);

            if (erro instanceof SyntaxError) {
                responderJSON(res, 400, {
                    mensagem: "Os dados enviados são inválidos."
                });
                return;
            }

            if (erro.code === "ER_DUP_ENTRY") {
                responderJSON(res, 409, {
                    mensagem: "CPF já cadastrado."
                });
                return;
            }

            responderJSON(res, 500, {
                mensagem: "Erro ao cadastrar paciente no banco de dados."
            });
        }

        return;
    }


    if (req.method === "PUT" &&
        /^\/api\/paciente\/\d+$/.test(caminho)) {

        try {
            var id = Number(caminho.split("/")[3]);
            var dados = await lerCorpo(req);

            var nome = String(dados.nome_completo || "").trim();
            var cpf = String(dados.cpf || "").replace(/\D/g, "");

            if (!Number.isSafeInteger(id) || id <= 0 ||
                !nome || !/^\d{11}$/.test(cpf)) {
                responderJSON(res, 400, {
                    mensagem: "Informe um paciente válido, nome e CPF com 11 dígitos."
                });
                return;
            }

            if (nome.length > 150) {
                responderJSON(res, 400, {
                    mensagem: "O nome deve ter no máximo 150 caracteres."
                });
                return;
            }

            var rg = dados.rg
                ? String(dados.rg).trim() || null
                : null;

            var nascimento = dados.data_nascimento || null;
            var pai = dados.nome_pai
                ? String(dados.nome_pai).trim() || null
                : null;

            var mae = dados.nome_mae
                ? String(dados.nome_mae).trim() || null
                : null;

            var enderecoPaciente = dados.endereco
                ? String(dados.endereco).trim() || null
                : null;

            var telefone = String(dados.telefone || "")
                .replace(/\D/g, "");

            if (nascimento) {
                var data = new Date(nascimento + "T00:00:00Z");

                if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) ||
                    isNaN(data.getTime()) ||
                    data.toISOString().slice(0, 10) !== nascimento) {
                    responderJSON(res, 400, {
                        mensagem: "Data de nascimento inválida."
                    });
                    return;
                }
            }

            if (telefone && !/^\d{10,11}$/.test(telefone)) {
                responderJSON(res, 400, {
                    mensagem: "Informe um telefone com DDD válido."
                });
                return;
            }

            var pacienteAtual = await conexao.execute(
                "SELECT id_paciente FROM paciente WHERE id_paciente = ? LIMIT 1",
                [id]
            );

            if (pacienteAtual[0].length === 0) {
                responderJSON(res, 404, {
                    mensagem: "Paciente não encontrado."
                });
                return;
            }

            var cpfExistente = await conexao.execute(
                "SELECT id_paciente FROM paciente WHERE cpf = ? AND id_paciente <> ? LIMIT 1",
                [cpf, id]
            );

            if (cpfExistente[0].length > 0) {
                responderJSON(res, 409, {
                    mensagem: "Este CPF já está cadastrado para outro paciente."
                });
                return;
            }

            await conexao.execute(
                `UPDATE paciente
                 SET nome_completo = ?, cpf = ?, rg = ?, data_nascimento = ?,
                     nome_pai = ?, nome_mae = ?, endereco = ?, telefone = ?
                 WHERE id_paciente = ?`,
                [
                    nome,
                    cpf,
                    rg,
                    nascimento,
                    pai,
                    mae,
                    enderecoPaciente,
                    telefone || null,
                    id
                ]
            );

            responderJSON(res, 200, {
                mensagem: "Dados pessoais alterados com sucesso."
            });

        } catch (erro) {
            console.error("Erro ao alterar paciente:", erro);

            if (erro.code === "ER_DUP_ENTRY") {
                responderJSON(res, 409, {
                    mensagem: "Este CPF já está cadastrado para outro paciente."
                });
                return;
            }

            if (erro instanceof SyntaxError) {
                responderJSON(res, 400, {
                    mensagem: "Os dados enviados são inválidos."
                });
                return;
            }

            responderJSON(res, 500, {
                mensagem: "Erro ao alterar os dados pessoais."
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
