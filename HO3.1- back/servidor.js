var http = require("http");
var fs = require("fs");
var path = require("path");
var mysql = require("mysql2/promise");
var config = require("./config");

var conexao = mysql.createPool(config.banco);

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

    if (req.method === "GET") {
        var arquivo = path.resolve(
            __dirname,
            "." + caminho
        );

        var pastaProjeto = path.resolve(__dirname) + path.sep;

        var arquivosBloqueados = [
            "servidor.js",
            "config.js",
            "package.json",
            "package-lock.json"
        ];

        if (
            !arquivo.startsWith(pastaProjeto) ||
            arquivosBloqueados.includes(path.basename(arquivo)) ||
            !/\.(html|css|js|png|jpe?g|svg|ico)$/i.test(arquivo)
        ) {
            res.writeHead(403);
            res.end("Acesso não permitido.");
            return;
        }

        fs.readFile(arquivo, function (erro, conteudo) {
            if (erro) {
                res.writeHead(404, {
                    "Content-Type": "text/plain; charset=utf-8"
                });

                res.end("Página ou arquivo não encontrado.");
                return;
            }

            var extensao = path.extname(arquivo).toLowerCase();

            var tipos = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon"
            };

            res.writeHead(200, {
                "Content-Type": tipos[extensao]
            });

            res.end(conteudo);
        });

        return;
    }

    responderJSON(res, 404, {
        mensagem: "Rota não encontrada."
    });
}

var servidor = http.createServer(async function (req, res) {
    try {
        await tratarRequisicao(req, res);
    } catch (erro) {
        console.error("Erro no servidor:", erro);

        if (!res.headersSent) {
            responderJSON(res, 500, {
                mensagem: "Erro interno no servidor."
            });
        } else {
            res.end();
        }
    }
});

servidor.listen(config.porta, function () {
    console.log(
        "Servidor iniciado em http://localhost:" + config.porta
    );
});