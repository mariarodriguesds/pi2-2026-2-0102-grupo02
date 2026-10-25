
var http = require("http");
var fs = require("fs");
var mysql = require("mysql2/promise");
var config = require("./config");
var path = require("path");

var conexao = mysql.createPool(config.banco);
var PASTA_FRONT = __dirname;

function responderJSON(res, status, dados) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8"
    });

    res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
    return new Promise(function (resolve, reject) {
        var corpo = "";

        req.on("data", function (parte) {
            corpo += parte;
        });

        req.on("end", function () {
            try {
                resolve(JSON.parse(corpo || "{}"));
            } catch (erro) {
                reject(erro);
            }
        });

        req.on("error", reject);
    });
}

async function tratarRequisicao(req, res) {
    var endereco = new URL(req.url, "http://localhost");
    var caminho = decodeURIComponent(endereco.pathname);

    // 1. Consultar paciente pelo CPF
    if (req.method === "GET" &&
        /^\/api\/paciente\/[^/]+$/.test(caminho)) {

        var cpfBusca = caminho.split("/")[3].replace(/\D/g, "");

        if (!/^\d{11}$/.test(cpfBusca)) {
            responderJSON(res, 400, {
                mensagem: "Informe um CPF válido com 11 dígitos."
            });
            return;
        }

        try {
            var resultado = await conexao.execute(
                "SELECT * FROM paciente WHERE cpf = ? LIMIT 1",
                [cpfBusca]
            );

            if (resultado[0].length === 0) {
                responderJSON(res, 404, {
                    mensagem: "Paciente não encontrado."
                });
                return;
            }

            responderJSON(res, 200, {
                paciente: resultado[0][0]
            });
        } catch (erro) {
            console.error("Erro ao consultar paciente:", erro);

            responderJSON(res, 500, {
                mensagem: "Erro ao consultar o paciente."
            });
        }

        return;
    }

    // 2. Editar paciente
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

    // 3. Abrir páginas, CSS, JavaScript e imagens
    if (req.method === "GET") {
        var caminhoArquivo = caminho === "/"
            ? "index.html"
            : caminho.substring(1);

        var arquivo = path.resolve(PASTA_FRONT, caminhoArquivo);

        if (arquivo.startsWith(PASTA_FRONT + path.sep)) {
            try {
                var conteudo = await fs.promises.readFile(arquivo);
                var extensao = path.extname(arquivo).toLowerCase();

                var tipos = {
                    ".html": "text/html; charset=utf-8",
                    ".css": "text/css; charset=utf-8",
                    ".js": "text/javascript; charset=utf-8",
                    ".json": "application/json; charset=utf-8",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".svg": "image/svg+xml",
                    ".ico": "image/x-icon"
                };

                res.writeHead(200, {
                    "Content-Type": tipos[extensao] ||
                        "application/octet-stream"
                });

                res.end(conteudo);
                return;
            } catch (erro) {
                // O arquivo não foi encontrado; responder abaixo.
            }
        }
    }

    // 4. Nenhuma rota correspondeu à requisição
    responderJSON(res, 404, {
        mensagem: "Rota não encontrada."
    });
}

var servidor = http.createServer(function (req, res) {
    tratarRequisicao(req, res).catch(function (erro) {
        console.error("Erro no servidor:", erro);

        if (!res.headersSent) {
            responderJSON(res, 500, {
                mensagem: "Erro interno no servidor."
            });
        } else {
            res.end();
        }
    });
});

servidor.listen(config.porta, function () {
    console.log("Servidor iniciado na porta " + config.porta);
});
