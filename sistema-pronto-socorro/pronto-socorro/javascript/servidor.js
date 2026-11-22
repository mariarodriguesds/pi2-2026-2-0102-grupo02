
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
            a.motivo_cancelamento AS motivoCancelamento,
            a.data_hora_cancelamento AS dataHoraCancelamento,
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

async function buscarAtendimentoPorNumero(numero) {
    const sql = `
        SELECT
            a.id_atendimento AS id,
            a.numero_atendimento AS numero,
            a.status AS status,
            a.data_hora_chegada AS dataHoraChegada,
            a.data_hora_confirmacao AS dataHoraAlta,
            a.orientacoes AS orientacoes,
            p.id_paciente AS idPaciente,
            p.nome_completo AS nome,
            p.cpf AS cpf,
            DATE_FORMAT(p.data_nascimento, '%Y-%m-%d') AS dataNascimento,
            t.pressao_arterial AS pressaoArterial,
            t.temperatura AS temperatura,
            t.batimentos_cardiacos AS batimentosCardiacos,
            t.classificacao_manchester AS classificacao,
            t.principais_queixas AS principaisQueixas,
            t.data_hora_triagem AS dataHoraTriagem
        FROM atendimento a
        JOIN paciente p ON p.id_paciente = a.id_paciente
        LEFT JOIN triagem t ON t.id_atendimento = a.id_atendimento
        WHERE a.numero_atendimento = ?
        LIMIT 1
    `;

    const [linhas] = await conexao.execute(sql, [numero.toUpperCase()]);

    if (linhas.length === 0) {
        return null;
    }

    var atendimento = linhas[0];

    // Medicações já registradas nesse atendimento
    const [medicacoes] = await conexao.execute(
        `SELECT nome, posologia
         FROM medicacao
         WHERE id_atendimento = ?
         ORDER BY id_medicacao`,
        [atendimento.id]
    );

    atendimento.medicacoes = medicacoes;

    return atendimento;
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
        '/alterar-atendimento.html': 'alterar-atendimento.html',
        '/atendimento-medico.html': 'atendimento-medico.html',
        '/consulta-atendimento.html': 'consulta-atendimento.html',
        '/editar-paciente.html': 'editar-paciente.html',
        '/medico.html': 'medico.html',
        '/reclassificar.html': 'reclassificar.html',
        '/tirar-paciente.html': 'tirar-paciente.html',
        '/triagem.html': 'triagem.html',
        '/paciente-nao-encontrado.html': 'paciente-nao-encontrado.html',
        '/script.js': 'JavaScript/script.js',
        '/css/geral.css': 'css/geral.css',
        '/css/inicio.css': 'css/inicio.css',
        '/css/recepcao.css': 'css/recepcao.css',
        '/css/triagem.css': 'css/triagem.css',
        '/css/medico.css': 'css/medico.css'
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

    // Lista atendimentos aguardando médico
    async function listarAtendimentosAguardandoMedico() {

        const sql = `
            SELECT
                a.numero_atendimento AS numero,
                a.status AS status,
                p.nome_completo AS nome,
                DATE_FORMAT(p.data_nascimento, '%Y-%m-%d') AS dataNascimento,
                t.classificacao_manchester AS classificacao
            FROM atendimento a
            JOIN paciente p
                ON p.id_paciente = a.id_paciente
            JOIN triagem t
                ON t.id_atendimento = a.id_atendimento
            WHERE a.status = 'AGUARDANDO_MEDICO'
            ORDER BY
                CASE t.classificacao_manchester
                    WHEN 'VERMELHO' THEN 1
                    WHEN 'LARANJA' THEN 2
                    WHEN 'AMARELO' THEN 3
                    WHEN 'VERDE' THEN 4
                    WHEN 'AZUL' THEN 5
                END,
                a.numero_atendimento ASC
        `;

        const [linhas] = await conexao.execute(sql);

        return linhas;
    }

    // Lista atendimentos aguardando médico
    if (
        req.method === 'GET' &&
        caminho === '/api/atendimentos/aguardando-medico'
    ) {

        try {

            const atendimentos =
                await listarAtendimentosAguardandoMedico();

            responderJSON(res, 200, {
                mensagem: 'Atendimentos aguardando médico.',
                atendimentos: atendimentos
            });

        } catch (erro) {

            console.error(
                'Erro ao listar atendimentos aguardando médico:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao listar atendimentos aguardando médico.'
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


    // HXX - Cancela um atendimento com motivo
    // Só permite cancelar antes de o médico assumir.
    if (
        req.method === 'POST' &&
        /^\/api\/atendimentos\/AT\d+\/cancelar$/i.test(caminho)
    ) {

        var numeroCancelar = caminho.split('/')[3].toUpperCase();

        var dados;

        try {
            dados = await lerCorpo(req);
        } catch (erro) {
            responderJSON(res, 400, {
                mensagem: 'Dados inválidos.'
            });
            return;
        }

        var motivo = String(dados.motivo || '').trim();

        if (!motivo) {
            responderJSON(res, 400, {
                mensagem: 'Informe o motivo do cancelamento.'
            });
            return;
        }

        var conexaoCancelamento;

        try {

            conexaoCancelamento = await conexao.getConnection();

            await conexaoCancelamento.beginTransaction();

            const [atendimentos] = await conexaoCancelamento.execute(
                `SELECT id_atendimento, status
                 FROM atendimento
                 WHERE numero_atendimento = ?
                 FOR UPDATE`,
                [numeroCancelar]
            );

            if (atendimentos.length === 0) {

                await conexaoCancelamento.rollback();

                responderJSON(res, 404, {
                    mensagem: 'Atendimento não encontrado.'
                });

                return;
            }

            var statusAtual = atendimentos[0].status;

            // Só permite cancelar antes de o médico assumir
            if (
                statusAtual !== 'ABERTO' &&
                statusAtual !== 'AGUARDANDO_TRIAGEM' &&
                statusAtual !== 'AGUARDANDO_MEDICO'
            ) {

                await conexaoCancelamento.rollback();

                responderJSON(res, 409, {
                    mensagem: 'Não é possível cancelar este atendimento. O médico já assumiu ou o atendimento já foi finalizado.'
                });

                return;
            }

            await conexaoCancelamento.execute(
                `UPDATE atendimento
                 SET status = 'CANCELADO',
                     motivo_cancelamento = ?,
                     data_hora_cancelamento = NOW()
                 WHERE id_atendimento = ?`,
                [
                    motivo,
                    atendimentos[0].id_atendimento
                ]
            );

            await conexaoCancelamento.commit();

            responderJSON(res, 200, {
                mensagem: 'Atendimento cancelado com sucesso.'
            });

        } catch (erro) {

            if (conexaoCancelamento) {
                try {
                    await conexaoCancelamento.rollback();
                } catch (erroRollback) {
                    console.error(
                        'Erro ao desfazer o cancelamento:',
                        erroRollback
                    );
                }
            }

            console.error('Erro ao cancelar atendimento:', erro);

            responderJSON(res, 500, {
                mensagem: 'Erro ao cancelar o atendimento.'
            });

        } finally {

            if (conexaoCancelamento) {
                conexaoCancelamento.release();
            }

        }

        return;
    }

    // H12.3 - Médico acessa o atendimento
    // AGUARDANDO_MEDICO -> EM_ATENDIMENTO
    if (
        req.method === 'POST' &&
        /^\/api\/medico\/atender\/AT\d+$/i.test(caminho)
    ) {

        var numeroAtender = caminho.split('/')[4].toUpperCase();

        try {

            const [resultado] = await conexao.execute(
                `UPDATE atendimento
                SET status = 'EM_ATENDIMENTO'
                WHERE numero_atendimento = ?
                AND status = 'AGUARDANDO_MEDICO'`,
                [numeroAtender]
            );

            if (resultado.affectedRows === 0) {

                const [atendimentoAtual] = await conexao.execute(
                    `SELECT status
                    FROM atendimento
                    WHERE numero_atendimento = ?
                    LIMIT 1`,
                    [numeroAtender]
                );

                if (atendimentoAtual.length === 0) {
                    responderJSON(res, 404, {
                        mensagem: 'Atendimento não encontrado.'
                    });
                    return;
                }

                responderJSON(res, 409, {
                    mensagem: 'Este atendimento não está aguardando atendimento médico.'
                });

                return;
            }

            var atendimentoMedico =
                await buscarAtendimentoPorNumero(numeroAtender);

            responderJSON(res, 200, {
                mensagem: 'Atendimento iniciado pelo médico.',
                atendimento: atendimentoMedico
            });

        } catch (erro) {

            console.error(
                'Erro ao iniciar atendimento médico:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao iniciar atendimento médico.'
            });
        }

        return;
    }



    // H07.2 - Grava a triagem e H09.2 - encaminha para o médico
    if (req.method === "POST" && caminho === "/api/triagem") {

        var dados;

        try {
            dados = await lerCorpo(req);
        } catch (erro) {
            responderJSON(res, 400, {
                mensagem: "Dados inválidos."
            });
            return;
        }

        var idAtendimento = Number(dados.idAtendimento);

        var pressaoArterial = dados.pressaoArterial || null;
        var temperatura = dados.temperatura || null;
        var batimentosCardiacos = dados.batimentosCardiacos || null;

        var classificacaoManchester = String(
            dados.classificacaoManchester || ""
        ).trim().toUpperCase();

        var principaisQueixas = String(
            dados.principaisQueixas || ""
        ).trim() || null;

        if (!idAtendimento || idAtendimento <= 0) {
            responderJSON(res, 400, {
                mensagem: "Informe o atendimento da triagem."
            });
            return;
        }

        if (![
            "VERMELHO",
            "LARANJA",
            "AMARELO",
            "VERDE",
            "AZUL"
        ].includes(classificacaoManchester)) {
            responderJSON(res, 400, {
                mensagem: "Classificação de Manchester inválida."
            });
            return;
        }

        var conexaoTriagem;

        try {

            conexaoTriagem = await conexao.getConnection();

            await conexaoTriagem.beginTransaction();

            const [atendimento] = await conexaoTriagem.execute(
                `SELECT id_atendimento, status
                FROM atendimento
                WHERE id_atendimento = ?
                FOR UPDATE`,
                [idAtendimento]
            );

            if (atendimento.length === 0) {

                await conexaoTriagem.rollback();

                responderJSON(res, 404, {
                    mensagem: "Atendimento não encontrado."
                });

                return;
            }

            if (atendimento[0].status !== "AGUARDANDO_TRIAGEM" && atendimento[0].status !== "AGUARDANDO_MEDICO") {

                await conexaoTriagem.rollback();

                responderJSON(res, 409, {
                    mensagem: "A classificação Manchester não pode ser alterada neste status."
                });

                return;
            }

            if (atendimento[0].status === "AGUARDANDO_TRIAGEM") {

                await conexaoTriagem.execute(
                    `INSERT INTO triagem
                        (id_atendimento, pressao_arterial, temperatura,
                        batimentos_cardiacos, classificacao_manchester,
                        principais_queixas)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        idAtendimento,
                        pressaoArterial,
                        temperatura,
                        batimentosCardiacos,
                        classificacaoManchester,
                        principaisQueixas
                    ]
                );

            } else if (atendimento[0].status === "AGUARDANDO_MEDICO") {

                await conexaoTriagem.execute(
                    `UPDATE triagem
                    SET pressao_arterial = ?,
                        temperatura = ?,
                        batimentos_cardiacos = ?,
                        classificacao_manchester = ?,
                        principais_queixas = ?,
                        data_hora_triagem = CURRENT_TIMESTAMP
                    WHERE id_atendimento = ?`,
                    [
                        pressaoArterial,
                        temperatura,
                        batimentosCardiacos,
                        classificacaoManchester,
                        principaisQueixas,
                        idAtendimento
                    ]
                );
            }

            await conexaoTriagem.execute(
                `UPDATE atendimento
                SET status = 'AGUARDANDO_MEDICO'
                WHERE id_atendimento = ?`,
                [idAtendimento]
            );

            await conexaoTriagem.commit();

            responderJSON(res, 201, {
                mensagem: "Triagem registrada com sucesso. Atendimento encaminhado para o médico."
            });

        } catch (erro) {

            if (conexaoTriagem) {
                try {
                    await conexaoTriagem.rollback();
                } catch (erroRollback) {
                    console.error("Erro ao desfazer a transação:", erroRollback);
                }
            }

            console.error("Erro ao gravar triagem:", erro);

            if (erro.code === "ER_DUP_ENTRY") {
                responderJSON(res, 409, {
                    mensagem: "Este atendimento já possui uma triagem."
                });
                return;
            }

            responderJSON(res, 500, {
                mensagem: "Erro ao gravar a triagem."
            });

        } finally {

            if (conexaoTriagem) {
                conexaoTriagem.release();
            }

        }

        return;
    }


    // H10.1 - Painel do médico: atendimentos aguardando médico
    if (req.method === 'GET' && caminho === '/api/medico/fila') {
        try {
            var fila = await listarAtendimentosAguardandoMedico();

            responderJSON(res, 200, {
                mensagem: 'Atendimentos aguardando médico.',
                atendimentos: fila
            });

        } catch (erro) {
            console.error('Erro ao listar a fila do médico:', erro.message);

            responderJSON(res, 500, {
                mensagem: 'Erro ao listar os atendimentos aguardando médico.'
            });
        }

        return;
    }


    // H13.2 - Grava medicações e orientações
    // Só no atendimento que está Em atendimento.
    // Corpo: { "medicacoes": [ { "nome": "Dipirona", "posologia": "500 mg de 6 em 6 horas" } ],
    //          "orientacoes": "Repouso e hidratação" }
    if (req.method === 'POST' && /^\/api\/medico\/medicacoes\/AT\d+$/i.test(caminho)) {

        var numeroMedicacao = caminho.split('/')[4].toUpperCase();
        var dadosMedicacao;

        try {
            dadosMedicacao = await lerCorpo(req);
        } catch (erro) {
            responderJSON(res, 400, {
                mensagem: 'Dados inválidos.'
            });
            return;
        }

        var medicacoes = dadosMedicacao.medicacoes || [];
        var orientacoes = String(dadosMedicacao.orientacoes || '').trim();

        if (!Array.isArray(medicacoes)) {
            responderJSON(res, 400, {
                mensagem: 'Envie as medicações em uma lista.'
            });
            return;
        }

        if (medicacoes.length === 0 && orientacoes === '') {
            responderJSON(res, 400, {
                mensagem: 'Informe ao menos uma medicação ou as orientações.'
            });
            return;
        }

        // Toda medicação precisa ter nome
        for (var i = 0; i < medicacoes.length; i++) {
            if (!medicacoes[i] || String(medicacoes[i].nome || '').trim() === '') {
                responderJSON(res, 400, {
                    mensagem: 'Informe o nome de cada medicação.'
                });
                return;
            }
        }

        try {
            var atendimentoMed = await buscarAtendimentoPorNumero(numeroMedicacao);

            if (!atendimentoMed) {
                responderJSON(res, 404, {
                    mensagem: 'Atendimento não encontrado.'
                });
                return;
            }

            if (atendimentoMed.status !== 'EM_ATENDIMENTO') {
                responderJSON(res, 409, {
                    mensagem: 'Só é possível registrar medicações em um atendimento Em atendimento.'
                });
                return;
            }

            for (var j = 0; j < medicacoes.length; j++) {
                await conexao.execute(
                    `INSERT INTO medicacao (id_atendimento, nome, posologia)
                     VALUES (?, ?, ?)`,
                    [
                        atendimentoMed.id,
                        String(medicacoes[j].nome).trim(),
                        String(medicacoes[j].posologia || '').trim() || null
                    ]
                );
            }

            if (orientacoes !== '') {
                await conexao.execute(
                    `UPDATE atendimento
                     SET orientacoes = ?
                     WHERE id_atendimento = ?`,
                    [orientacoes, atendimentoMed.id]
                );
            }

            responderJSON(res, 201, {
                mensagem: 'Medicações e orientações registradas.',
                atendimento: await buscarAtendimentoPorNumero(numeroMedicacao)
            });

        } catch (erro) {
            console.error('Erro ao gravar medicações:', erro.message);

            responderJSON(res, 500, {
                mensagem: 'Erro ao gravar as medicações e orientações.'
            });
        }

        return;
    }


    // H14.2 - Confirma o atendimento e registra a alta
    // Em atendimento -> Confirmado / Alta, com a data e hora da alta.
    // Exemplo: POST /api/medico/alta/AT0001
    if (req.method === 'POST' && /^\/api\/medico\/alta\/AT\d+$/i.test(caminho)) {

        var numeroAlta = caminho.split('/')[4].toUpperCase();

        try {
            const [resultadoAlta] = await conexao.execute(
                `UPDATE atendimento
                 SET status = 'CONFIRMADO',
                     data_hora_confirmacao = NOW()
                 WHERE numero_atendimento = ? AND status = 'EM_ATENDIMENTO'`,
                [numeroAlta]
            );

            if (resultadoAlta.affectedRows === 0) {
                var atendimentoAlta = await buscarAtendimentoPorNumero(numeroAlta);

                if (!atendimentoAlta) {
                    responderJSON(res, 404, {
                        mensagem: 'Atendimento não encontrado.'
                    });
                    return;
                }

                responderJSON(res, 409, {
                    mensagem: 'Só é possível dar alta em um atendimento Em atendimento.'
                });
                return;
            }

            responderJSON(res, 200, {
                mensagem: 'Atendimento confirmado e alta registrada.',
                atendimento: await buscarAtendimentoPorNumero(numeroAlta)
            });

        } catch (erro) {
            console.error('Erro ao registrar a alta:', erro.message);

            responderJSON(res, 500, {
                mensagem: 'Erro ao registrar a alta.'
            });
        }

        return;
    }



    // Consulta os dados da triagem ao reabrir um atendimento
    if (
        req.method === 'GET' &&
        /^\/api\/triagem\/AT\d+$/i.test(caminho)
    ) {

        var numeroTriagem = caminho.split('/')[3].toUpperCase();

        try {

            var atendimentoTriagem =
                await buscarAtendimentoPorNumero(numeroTriagem);

            if (!atendimentoTriagem) {
                responderJSON(res, 404, {
                    mensagem: 'Atendimento não encontrado.'
                });
                return;
            }

            responderJSON(res, 200, {
                mensagem: 'Dados da triagem encontrados.',
                atendimento: atendimentoTriagem
            });

        } catch (erro) {

            console.error(
                'Erro ao consultar triagem:',
                erro.message
            );

            responderJSON(res, 500, {
                mensagem: 'Erro ao consultar os dados da triagem.'
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


    // H11.1 - Altera o atendimento (paciente e data/hora de chegada)
    // Recusa quando ele já está Confirmado / Alta ou Cancelado.
    // Corpo: { "cpf": "12345678901", "dataHoraChegada": "2026-11-20T14:30" }
    if (req.method === 'PUT' && /^\/api\/atendimentos\/AT\d+$/i.test(caminho)) {

        var numeroAlterar = caminho.split('/')[3].toUpperCase();
        var dadosAlterar;

        try {
            dadosAlterar = await lerCorpo(req);
        } catch (erro) {
            responderJSON(res, 400, {
                mensagem: 'Dados inválidos.'
            });
            return;
        }

        var cpfAlterar = String(dadosAlterar.cpf || '').replace(/\D/g, '');

        // O datetime-local manda "2026-11-20T14:30"; o MySQL quer "2026-11-20 14:30"
        var chegada = String(dadosAlterar.dataHoraChegada || '').replace('T', ' ');

        if (cpfAlterar.length !== 11) {
            responderJSON(res, 400, {
                mensagem: 'CPF inválido.'
            });
            return;
        }

        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(chegada)) {
            responderJSON(res, 400, {
                mensagem: 'Informe a data e hora de chegada.'
            });
            return;
        }

        try {
            var atendimentoAlterar = await buscarAtendimentoPorNumero(numeroAlterar);

            if (!atendimentoAlterar) {
                responderJSON(res, 404, {
                    mensagem: 'Atendimento não encontrado.'
                });
                return;
            }

            if (atendimentoAlterar.status === 'CONFIRMADO' ||
                atendimentoAlterar.status === 'CANCELADO') {
                responderJSON(res, 409, {
                    mensagem: 'Este atendimento já foi encerrado e não pode mais ser alterado.'
                });
                return;
            }

            var pacienteNovo = await buscarPacientePorCPF(cpfAlterar);

            if (!pacienteNovo) {
                responderJSON(res, 404, {
                    mensagem: 'Paciente não encontrado.'
                });
                return;
            }

            // O status entra no WHERE para não alterar se ele foi encerrado agora há pouco
            const [resultadoAlterar] = await conexao.execute(
                `UPDATE atendimento
                 SET id_paciente = ?, data_hora_chegada = ?
                 WHERE id_atendimento = ?
                   AND status NOT IN ('CONFIRMADO', 'CANCELADO')`,
                [pacienteNovo.id, chegada, atendimentoAlterar.id]
            );

            if (resultadoAlterar.affectedRows === 0) {
                responderJSON(res, 409, {
                    mensagem: 'Este atendimento já foi encerrado e não pode mais ser alterado.'
                });
                return;
            }

            responderJSON(res, 200, {
                mensagem: 'Atendimento alterado.',
                atendimento: await buscarAtendimentoPorNumero(numeroAlterar)
            });

        } catch (erro) {
            console.error('Erro ao alterar atendimento:', erro.message);

            responderJSON(res, 500, {
                mensagem: 'Erro ao alterar o atendimento.'
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
