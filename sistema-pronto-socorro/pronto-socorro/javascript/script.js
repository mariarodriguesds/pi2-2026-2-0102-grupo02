async function lerResposta(resposta) {
    try {
        return await resposta.json();

    } catch (erro) {
        return {
            mensagem: "Não foi possível interpretar a resposta do servidor."
        };
    }
}

// Faz a requisição e lança erro (com .status) quando a resposta não é OK
async function api(url, opcoes) {
    let resposta;

    try {
        resposta = await fetch(url, opcoes);
    } catch (erro) {
        throw new Error("Erro ao conectar com o servidor.");
    }

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
        const erro = new Error(dados.mensagem || "Erro na operação.");
        erro.status = resposta.status;
        throw erro;
    }

    return dados;
}

function enviarJSON(url, metodo, dados) {
    return api(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });
}

function limparCPF(cpf) {
    return String(cpf || "").replace(/\D/g, "");
}

function mostrarMensagem(elemento, mensagem) {
    if (elemento) {
        elemento.textContent = mensagem;
    }
}

// Converte a data do servidor para "AAAA-MM-DDTHH:MM:SS" (horário local)
function paraDataHoraLocal(valor) {
    const data = new Date(valor);

    if (isNaN(data.getTime())) {
        return "";
    }

    const p = function (n) { return String(n).padStart(2, "0"); };

    return data.getFullYear() + "-" + p(data.getMonth() + 1) + "-" +
        p(data.getDate()) + "T" + p(data.getHours()) + ":" +
        p(data.getMinutes()) + ":" + p(data.getSeconds());
}

// CPF vindo da URL (ex.: recepcao.html?cpf=12345678901)
const cpfDaURL = new URLSearchParams(window.location.search).get("cpf") || "";


// ============================================================
// RECEPÇÃO - CONSULTA DE PACIENTES
// ============================================================

let idPacienteEncontrado = null;
let pacienteAtual = null;

const formConsulta = document.getElementById("formConsulta");
const resultado = document.getElementById("resultado");
const areaAtendimento = document.getElementById("areaAtendimento");

if (formConsulta) {

    const campoCPFConsulta = document.getElementById("cpf");

    if (cpfDaURL && campoCPFConsulta) {
        campoCPFConsulta.value = cpfDaURL;
    }

    formConsulta.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        idPacienteEncontrado = null;
        pacienteAtual = null;

        if (areaAtendimento) {
            areaAtendimento.hidden = true;
        }

        const atendimentoAbertoEl = document.getElementById("atendimentoAberto");

        if (atendimentoAbertoEl) {
            atendimentoAbertoEl.hidden = true;
        }

        mostrarMensagem(document.getElementById("mensagemAtendimento"), "");

        const cpfLimpo = limparCPF(campoCPFConsulta.value.trim());

        if (!/^\d{11}$/.test(cpfLimpo)) {

            resultado.textContent = "Informe um CPF com 11 dígitos.";

            return;
        }

        resultado.textContent = "Buscando...";

        try {

            const resposta = await fetch(
                "/api/paciente/" + encodeURIComponent(cpfLimpo)
            );

            const dados = await lerResposta(resposta);

            // Não encontrado: vai para a tela de cadastro levando o CPF
            if (resposta.status === 404 && dados.redirecionarPara) {

                window.location.href =
                    dados.redirecionarPara +
                    "?cpf=" + encodeURIComponent(cpfLimpo);

                return;
            }

            if (!resposta.ok) {

                resultado.textContent =
                    dados.mensagem || "Erro ao consultar paciente.";

                return;
            }

            pacienteAtual = dados.paciente;
            idPacienteEncontrado = dados.paciente.id;

            resultado.textContent =
                "Paciente encontrado! Nome: " + dados.paciente.nome +
                " | CPF: " + dados.paciente.cpf +
                " | Data de nascimento: " +
                (dados.paciente.dataNascimento
                    ? String(dados.paciente.dataNascimento).substring(0, 10)
                    : "Não informada");

            // Atalho para editar os dados pessoais deste paciente
            const editar = document.createElement("a");
            editar.className = "botao botao-secundario";
            editar.href = "/editar-paciente.html?cpf=" +
                encodeURIComponent(dados.paciente.cpf);
            editar.textContent = "Editar dados pessoais";

            resultado.append(document.createElement("br"), editar);

            if (areaAtendimento) {
                areaAtendimento.hidden = false;
            }

        } catch (erro) {

            resultado.textContent = "Erro ao conectar com o servidor.";

            console.error("Erro na consulta:", erro);

        }

    });

    // Veio de outra tela com o CPF: já faz a consulta
    if (cpfDaURL) {
        formConsulta.requestSubmit();
    }

}


// ============================================================
// H05.1 - ABRE ATENDIMENTO
// ============================================================

const botaoAbrirAtendimento =
    document.getElementById("botaoAbrirAtendimento");

const mensagemAtendimento =
    document.getElementById("mensagemAtendimento");

const atendimentoAberto =
    document.getElementById("atendimentoAberto");

const numeroAtendimento =
    document.getElementById("numeroAtendimento");

if (botaoAbrirAtendimento) {

    botaoAbrirAtendimento.addEventListener("click", async function () {

        mensagemAtendimento.textContent = "";

        if (!idPacienteEncontrado) {

            mensagemAtendimento.textContent =
                "Nenhum paciente selecionado.";

            return;
        }

        botaoAbrirAtendimento.disabled = true;

        mensagemAtendimento.textContent =
            "Abrindo atendimento...";

        try {

            const resposta = await fetch("/api/atendimentos", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    idPaciente: idPacienteEncontrado
                })

            });

            const dados = await lerResposta(resposta);

            if (!resposta.ok) {

                mensagemAtendimento.textContent =
                    dados.mensagem ||
                    "Não foi possível abrir o atendimento.";

                return;
            }

            mensagemAtendimento.textContent =
                dados.mensagem;

            numeroAtendimento.textContent =
                "Número do atendimento: " + dados.numero;

            atendimentoAberto.hidden = false;

        } catch (erro) {

            console.error(
                "Erro ao abrir atendimento:",
                erro
            );

            mensagemAtendimento.textContent =
                "Erro ao conectar com o servidor.";

        } finally {

            botaoAbrirAtendimento.disabled = false;

        }

    });

}


// ============================================================
// CADASTRO DE PACIENTES
// ============================================================

const formularioCadastro =
    document.getElementById("formCadastroPaciente");

const mensagemCadastro =
    document.getElementById("mensagem");

if (formularioCadastro) {

    // Veio da tela "paciente não encontrado": já preenche o CPF
    if (cpfDaURL) {
        const campoCPFCadastro = document.getElementById("cpf");

        if (campoCPFCadastro) {
            campoCPFCadastro.value = cpfDaURL;
        }
    }

    formularioCadastro.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const nome = document.getElementById("nome_completo").value.trim();

        const cpf = document.getElementById("cpf").value;
        const cpfLimpo = limparCPF(cpf);

        const rg = document.getElementById("rg").value.trim();

        const dataNascimento =
            document.getElementById("data_nascimento").value;

        const nomePai = document.getElementById("nome_pai").value.trim();
        const nomeMae = document.getElementById("nome_mae").value.trim();
        const endereco = document.getElementById("endereco").value.trim();

        const telefone = document.getElementById("telefone").value.trim();
        const telefoneLimpo = limparCPF(telefone);

        mostrarMensagem(mensagemCadastro, "");

        if (!nome || !cpfLimpo) {
            mostrarMensagem(mensagemCadastro,
                "Preencha o nome completo e o CPF.");
            return;
        }

        if (!/^\d{11}$/.test(cpfLimpo)) {
            mostrarMensagem(mensagemCadastro,
                "Informe um CPF com 11 dígitos.");
            return;
        }

        if (dataNascimento) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, "0");
            const dia = String(hoje.getDate()).padStart(2, "0");
            const dataAtual = `${ano}-${mes}-${dia}`;

            if (dataNascimento > dataAtual) {
                mostrarMensagem(mensagemCadastro,
                    "Informe uma data de nascimento válida.");
                return;
            }
        }

        if (telefoneLimpo && !/^\d{10,11}$/.test(telefoneLimpo)) {
            mostrarMensagem(mensagemCadastro,
                "Informe um telefone com DDD, contendo 10 ou 11 dígitos.");
            return;
        }

        const paciente = {
            nome_completo: nome,
            cpf: cpfLimpo,
            rg: rg || null,
            data_nascimento: dataNascimento || null,
            nome_pai: nomePai || null,
            nome_mae: nomeMae || null,
            endereco: endereco || null,
            telefone: telefoneLimpo || null
        };

        try {
            mostrarMensagem(mensagemCadastro, "Cadastrando paciente...");

            const resposta = await fetch("/api/paciente", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(paciente)
            });

            const dados = await lerResposta(resposta);

            if (resposta.status === 409) {
                mostrarMensagem(mensagemCadastro, "CPF já cadastrado.");
                return;
            }

            if (!resposta.ok) {
                mostrarMensagem(mensagemCadastro,
                    dados.mensagem || "Não foi possível cadastrar o paciente.");
                return;
            }

            mostrarMensagem(mensagemCadastro,
                "Paciente cadastrado com sucesso!");

            // Se veio da recepção, volta para ela já com o CPF consultado
            if (cpfDaURL) {
                setTimeout(function () {
                    window.location.href =
                        "/recepcao.html?cpf=" + encodeURIComponent(cpfLimpo);
                }, 1000);

                return;
            }

            formularioCadastro.reset();

        } catch (erro) {
            mostrarMensagem(mensagemCadastro,
                "Erro ao conectar com o servidor.");

            console.error("Erro no cadastro:", erro);
        }
    });
}


// ============================================================
// EDIÇÃO DE DADOS DO PACIENTE
// (funciona com a busca na própria tela ou com ?cpf= na URL)
// ============================================================

const formBuscar = document.getElementById("formBuscarPaciente");
const formEditar = document.getElementById("formEditarPaciente");

const campoCPFBusca = document.getElementById("cpfBusca");
const campoIdPaciente = document.getElementById("id_paciente");
const areaEdicao = document.getElementById("areaEdicao");

const mensagemBusca = document.getElementById("mensagemBusca");
const mensagemEdicao =
    document.getElementById("mensagemEdicao") ||
    document.getElementById("mensagem");

const botaoSalvar =
    document.getElementById("botaoSalvar") ||
    (formEditar ? formEditar.querySelector('button[type="submit"]') : null);

const botaoCancelarEdicao = document.getElementById("botaoCancelar");

let idPacienteEdicao = null;


function limparEdicao() {
    if (formEditar) {
        formEditar.reset();
    }

    if (campoIdPaciente) {
        campoIdPaciente.value = "";
    }

    idPacienteEdicao = null;

    if (areaEdicao) {
        areaEdicao.hidden = true;
    }

    mostrarMensagem(mensagemEdicao, "");
}


// Aceita tanto os nomes do banco quanto os nomes devolvidos pela API
function preencherCampos(paciente) {

    const valores = {
        nome_completo: paciente.nome_completo ?? paciente.nome,
        cpf: paciente.cpf,
        rg: paciente.rg,
        data_nascimento: paciente.data_nascimento ?? paciente.dataNascimento,
        nome_pai: paciente.nome_pai ?? paciente.nomePai,
        nome_mae: paciente.nome_mae ?? paciente.nomeMae,
        endereco: paciente.endereco,
        telefone: paciente.telefone
    };

    idPacienteEdicao = paciente.id_paciente ?? paciente.id;

    if (campoIdPaciente) {
        campoIdPaciente.value = idPacienteEdicao;
    }

    Object.keys(valores).forEach(function (campo) {
        const elemento = document.getElementById(campo);

        if (!elemento) {
            return;
        }

        let valor = valores[campo] || "";

        if (campo === "data_nascimento" && valor) {
            valor = String(valor).slice(0, 10);
        }

        elemento.value = valor;
    });
}


async function carregarPacienteParaEdicao(cpf, elementoMensagem) {

    mostrarMensagem(elementoMensagem, "Buscando paciente...");

    try {
        const resposta = await fetch(
            "/api/paciente/" + encodeURIComponent(cpf)
        );

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {
            mostrarMensagem(
                elementoMensagem,
                dados.mensagem || "Não foi possível encontrar o paciente."
            );
            return;
        }

        if (!dados.paciente) {
            mostrarMensagem(elementoMensagem, "Paciente não encontrado.");
            return;
        }

        preencherCampos(dados.paciente);

        if (areaEdicao) {
            areaEdicao.hidden = false;
        }

        if (botaoSalvar) {
            botaoSalvar.disabled = false;
        }

        mostrarMensagem(
            elementoMensagem,
            "Paciente encontrado! Você já pode alterar os dados."
        );

    } catch (erro) {
        console.error("Erro ao buscar paciente:", erro);

        mostrarMensagem(
            elementoMensagem,
            "Não foi possível conectar ao servidor. Tente novamente."
        );
    }
}


// Buscar paciente pelo CPF (tela com campo de busca)
if (formBuscar) {
    formBuscar.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        limparEdicao();
        mostrarMensagem(mensagemBusca, "");

        const cpf = limparCPF(campoCPFBusca.value);

        if (!/^\d{11}$/.test(cpf)) {
            mostrarMensagem(
                mensagemBusca,
                "Informe um CPF com 11 dígitos."
            );
            return;
        }

        await carregarPacienteParaEdicao(cpf, mensagemBusca);
    });
}


// Tela aberta com ?cpf= (vindo da recepção): carrega direto
if (formEditar && cpfDaURL) {

    const cpfURL = limparCPF(cpfDaURL);

    if (campoCPFBusca) {
        campoCPFBusca.value = cpfURL;
    }

    if (/^\d{11}$/.test(cpfURL)) {

        if (botaoSalvar) {
            botaoSalvar.disabled = true;
        }

        carregarPacienteParaEdicao(cpfURL, mensagemBusca || mensagemEdicao);
    }
}


// Salvar alterações do paciente
if (formEditar) {
    formEditar.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        mostrarMensagem(mensagemEdicao, "");

        const id =
            (campoIdPaciente && campoIdPaciente.value) || idPacienteEdicao;

        const cpf = limparCPF(
            document.getElementById("cpf").value
        );

        const nome =
            document.getElementById("nome_completo").value.trim();

        if (!id || !nome || nome.length > 150 ||
            !/^\d{11}$/.test(cpf)) {

            mostrarMensagem(
                mensagemEdicao,
                "Confira o nome e informe um CPF com 11 dígitos."
            );
            return;
        }

        const dadosPaciente = {
            nome_completo: nome,
            cpf: cpf,
            rg: document.getElementById("rg").value.trim(),
            data_nascimento:
                document.getElementById("data_nascimento").value || null,
            nome_pai: document.getElementById("nome_pai").value.trim(),
            nome_mae: document.getElementById("nome_mae").value.trim(),
            endereco: document.getElementById("endereco").value.trim(),
            telefone: document.getElementById("telefone").value.trim()
        };

        if (botaoSalvar) {
            botaoSalvar.disabled = true;
        }

        mostrarMensagem(mensagemEdicao, "Salvando alterações...");

        try {
            const resposta = await fetch(
                "/api/paciente/" + encodeURIComponent(id),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dadosPaciente)
                }
            );

            const dados = await lerResposta(resposta);

            if (!resposta.ok) {
                mostrarMensagem(
                    mensagemEdicao,
                    dados.mensagem || "Não foi possível salvar as alterações."
                );
                return;
            }

            mostrarMensagem(mensagemEdicao, "Alterações salvas com sucesso!");

            // Atualiza o CPF usado na próxima busca.
            if (campoCPFBusca) {
                campoCPFBusca.value = cpf;
            }

            // Veio da recepção: volta para ela já com o CPF consultado
            if (cpfDaURL) {
                setTimeout(function () {
                    window.location.href =
                        "/recepcao.html?cpf=" + encodeURIComponent(cpf);
                }, 800);
            }

        } catch (erro) {
            console.error("Erro ao salvar alterações:", erro);

            mostrarMensagem(
                mensagemEdicao,
                "Não foi possível conectar ao servidor. Tente novamente."
            );

        } finally {
            if (botaoSalvar) {
                botaoSalvar.disabled = false;
            }
        }
    });
}


// Cancelar a edição
if (botaoCancelarEdicao) {
    botaoCancelarEdicao.addEventListener("click", function () {
        limparEdicao();

        mostrarMensagem(mensagemBusca, "Edição cancelada.");
    });
}


// ============================================================
// Pinta o selo com a cor da classificação (ex.: VERMELHO -> cor-vermelho)
// ============================================================

function pintarSelo(selo, classificacao) {
    if (!selo) {
        return;
    }

    selo.classList.remove(
        "cor-vermelho", "cor-laranja", "cor-amarelo", "cor-verde", "cor-azul"
    );

    if (classificacao) {
        selo.classList.add("cor-" + String(classificacao).toLowerCase());
    }
}


// ============================================================
// TRIAGEM - classificação (aceita botões de rádio ou select)
// ============================================================

function lerClassificacaoManchester() {
    const marcada = document.querySelector(
        'input[name="CLASSIFICACAO_MANCHESTER"]:checked'
    );

    if (marcada) {
        return marcada.value;
    }

    const campo = document.getElementById("CLASSIFICACAO_MANCHESTER");

    return campo ? campo.value : "";
}

function definirClassificacaoManchester(valor) {
    const alvo = String(valor || "").toUpperCase();

    const radios = document.querySelectorAll(
        'input[name="CLASSIFICACAO_MANCHESTER"]'
    );

    if (radios.length > 0) {
        radios.forEach(function (radio) {
            radio.checked = radio.value.toUpperCase() === alvo;
        });
        return;
    }

    const campo = document.getElementById("CLASSIFICACAO_MANCHESTER");

    if (campo) {
        campo.value = valor || "";
    }
}


// H07.2 - Grava a triagem

const formularioTriagem =
    document.getElementById("formTriagem");

if (formularioTriagem) {

    formularioTriagem.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const classificacao = lerClassificacaoManchester();

        if (!classificacao) {
            alert("Selecione a classificação de Manchester.");
            return;
        }

        try {

            const resposta = await fetch("/api/triagem", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    idAtendimento: document.getElementById("ID_ATENDIMENTO").value,
                    pressaoArterial: document.getElementById("PRESSAO_ARTERIAL").value,
                    temperatura: document.getElementById("TEMPERATURA").value,
                    batimentosCardiacos: document.getElementById("BATIMENTOS_CARDIACOS").value,
                    classificacaoManchester: classificacao,
                    principaisQueixas: document.getElementById("PRINCIPAIS_QUEIXAS").value
                })
            });

            const dados = await lerResposta(resposta);

            if (!resposta.ok) {
                alert(dados.mensagem || "Erro ao registrar a triagem.");
                return;
            }

            alert(dados.mensagem);

            window.location.href = "triagem.html";

        } catch (erro) {

            console.error("Erro ao registrar triagem:", erro);

            alert("Erro ao conectar com o servidor.");

        }

    });

}


// ============================================================
// H07 - FILAS DA TRIAGEM
// ============================================================

// --- Fila com modelo (template) e link para triar-paciente.html ---

const listaTriagem = document.getElementById("listaTriagem");
const modeloFila = document.getElementById("modeloFila");
const mensagemFila = document.getElementById("mensagemFila");

const listaAguardando = document.getElementById("listaAguardando");
const modeloAguardando = document.getElementById("modeloAguardando");
const mensagemAguardando = document.getElementById("mensagemAguardando");


async function carregarFilaTriagem() {

    if (!listaTriagem || !modeloFila) {
        return;
    }

    try {

        const resposta = await fetch(
            "/api/atendimentos/aguardando-triagem"
        );

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {
            mostrarMensagem(mensagemFila,
                dados.mensagem || "Erro ao carregar a fila de triagem.");
            return;
        }

        listaTriagem.innerHTML = "";

        dados.atendimentos.forEach(function (atendimento) {

            const linha = modeloFila.content.cloneNode(true);

            linha.querySelector(".fila-numero").textContent =
                atendimento.numero;

            linha.querySelector(".fila-nome").textContent =
                atendimento.nome;

            linha.querySelector(".fila-chegada").textContent =
                atendimento.dataHoraChegada
                    ? new Date(atendimento.dataHoraChegada).toLocaleString("pt-BR")
                    : "Não informada";

            linha.querySelector(".fila-triar").href =
                "triar-paciente.html?numero=" +
                encodeURIComponent(atendimento.numero);

            listaTriagem.appendChild(linha);

        });

        mostrarMensagem(
            mensagemFila,
            dados.atendimentos.length === 0
                ? "Não há atendimentos aguardando triagem."
                : ""
        );

    } catch (erro) {

        console.error("Erro ao carregar fila de triagem:", erro);

        mostrarMensagem(mensagemFila, "Erro ao conectar com o servidor.");

    }
}


// Carrega os atendimentos que já passaram pela triagem
async function carregarFilaAguardando() {

    if (!listaAguardando || !modeloAguardando) {
        return;
    }

    try {

        const resposta = await fetch(
            "/api/atendimentos/aguardando-medico"
        );

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {
            mostrarMensagem(mensagemAguardando,
                dados.mensagem || "Erro ao carregar os atendimentos.");
            return;
        }

        listaAguardando.innerHTML = "";

        dados.atendimentos.forEach(function (atendimento) {

            const linha = modeloAguardando.content.cloneNode(true);

            linha.querySelector(".fila-numero").textContent =
                atendimento.numero;

            linha.querySelector(".fila-nome").textContent =
                atendimento.nome;

            linha.querySelector(".fila-cor").textContent =
                atendimento.classificacao;

            pintarSelo(linha.querySelector(".fila-cor"), atendimento.classificacao);

            linha.querySelector(".fila-reclassificar").href =
                "reclassificar.html?numero=" +
                encodeURIComponent(atendimento.numero);

            listaAguardando.appendChild(linha);

        });

        mostrarMensagem(
            mensagemAguardando,
            dados.atendimentos.length === 0
                ? "Não há atendimentos aguardando médico."
                : ""
        );

    } catch (erro) {

        console.error("Erro ao carregar atendimentos:", erro);

        mostrarMensagem(mensagemAguardando, "Erro ao conectar com o servidor.");

    }

}

carregarFilaTriagem();
carregarFilaAguardando();


// --- Fila com triagem rápida na própria linha (escolhe só a cor) ---

const coresTriagem = ["VERMELHO", "LARANJA", "AMARELO", "VERDE", "AZUL"];

function criarFormularioTriagemRapida(numero, atualizar) {

    const form = document.createElement("form");
    const rotulo = document.createElement("label");
    const cor = document.createElement("select");
    const botao = document.createElement("button");
    const mensagem = document.createElement("span");

    rotulo.textContent = "Classificação de " + numero + " ";

    cor.append(...coresTriagem.map(function (valor) {
        return new Option(valor, valor);
    }));
    cor.prepend(new Option("Selecione a cor", "", true, true));
    cor.required = true;

    botao.className = "botao";
    botao.textContent = "Registrar triagem";

    mensagem.setAttribute("role", "status");

    rotulo.append(cor);
    form.append(rotulo, botao, mensagem);

    form.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        botao.disabled = true;

        try {
            // A lista não traz o id do atendimento: busca pelo número
            const { atendimento } = await api(
                "/api/triagem/" + encodeURIComponent(numero)
            );

            await enviarJSON("/api/triagem", "POST", {
                idAtendimento: atendimento.id,
                classificacaoManchester: cor.value
            });

            await atualizar();

        } catch (erro) {
            mensagem.textContent = erro.message;

        } finally {
            botao.disabled = false;
        }
    });

    return form;
}

const filaTriagem = document.getElementById("filaTriagem");

if (filaTriagem) {

    let carregandoFilaTriagem = false;

    const atualizarFilaTriagem = async function () {

        if (carregandoFilaTriagem) {
            return;
        }

        carregandoFilaTriagem = true;

        try {
            const { atendimentos } = await api(
                "/api/atendimentos/aguardando-triagem"
            );

            filaTriagem.replaceChildren();

            mostrarMensagem(
                mensagemFila,
                atendimentos.length
                    ? atendimentos.length + " atendimento(s) aguardando."
                    : "Nenhum atendimento aguardando triagem."
            );

            atendimentos.forEach(function (atendimento) {

                const linha = document.createElement("p");

                linha.textContent =
                    atendimento.numero + " | " + atendimento.nome +
                    " | CPF: " + atendimento.cpf +
                    " | Chegada: " +
                    new Date(atendimento.dataHoraChegada).toLocaleString("pt-BR");

                const item = document.createElement("div");

                item.append(
                    linha,
                    criarFormularioTriagemRapida(
                        atendimento.numero,
                        atualizarFilaTriagem
                    )
                );

                filaTriagem.append(item);
            });

        } catch (erro) {
            mostrarMensagem(mensagemFila, erro.message);

        } finally {
            carregandoFilaTriagem = false;
        }
    };

    const botaoAtualizarFila = document.getElementById("atualizarFila");

    if (botaoAtualizarFila) {
        botaoAtualizarFila.addEventListener("click", atualizarFilaTriagem);
    }

    atualizarFilaTriagem();

    // Atualiza sozinho, sem atrapalhar quem está preenchendo
    setInterval(function () {
        if (!filaTriagem.contains(document.activeElement)) {
            atualizarFilaTriagem();
        }
    }, 15000);
}


// Mostra em cima do formulário qual é o atendimento e o paciente.
// Se a página tiver #numeroTriagem / #nomeTriagem usa esses campos;
// se não tiver, cria o bloco sozinho acima do formulário.
function mostrarResumoTriagem(atendimento) {

    const numeroEl = document.getElementById("numeroTriagem");
    const nomeEl = document.getElementById("nomeTriagem");

    if (numeroEl || nomeEl) {
        if (numeroEl) { numeroEl.textContent = atendimento.numero; }
        if (nomeEl) { nomeEl.textContent = atendimento.nome; }
        return;
    }

    let resumo = document.getElementById("resumoTriagem");

    if (!resumo) {
        resumo = document.createElement("div");
        resumo.id = "resumoTriagem";
        resumo.className = "resumo-atendimento";

        formularioTriagem.parentNode.insertBefore(resumo, formularioTriagem);
    }

    const linhas = [
        ["Atendimento ", atendimento.numero],
        ["Paciente ", atendimento.nome],
        ["CPF ", atendimento.cpf]
    ];

    resumo.replaceChildren();

    linhas.forEach(function (par) {
        const p = document.createElement("p");
        const forte = document.createElement("strong");

        forte.textContent = par[1];
        p.append(par[0], forte);
        resumo.append(p);
    });
}


// Carrega os dados do atendimento ao abrir a tela de triagem

async function carregarDadosTriagem() {

    if (!formularioTriagem) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const numero = parametros.get("numero");

    if (!numero) {
        return;
    }

    try {

        const resposta = await fetch(
            "/api/triagem/" + encodeURIComponent(numero)
        );

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {
            alert(dados.mensagem || "Não foi possível carregar o atendimento.");
            return;
        }

        const atendimento = dados.atendimento;

        mostrarResumoTriagem(atendimento);

        document.getElementById("ID_ATENDIMENTO").value =
            atendimento.id;

        document.getElementById("PRESSAO_ARTERIAL").value =
            atendimento.pressaoArterial || "";

        document.getElementById("TEMPERATURA").value =
            atendimento.temperatura || "";

        document.getElementById("BATIMENTOS_CARDIACOS").value =
            atendimento.batimentosCardiacos || "";

        definirClassificacaoManchester(atendimento.classificacao);

        document.getElementById("PRINCIPAIS_QUEIXAS").value =
            atendimento.principaisQueixas || "";

    } catch (erro) {

        console.error("Erro ao carregar dados da triagem:", erro);

        alert("Erro ao conectar com o servidor.");

    }

}

carregarDadosTriagem();


// ============================================================
// H12.3 - PAINEL DO MÉDICO (lista com botão Acessar)
// ============================================================

const listaMedico = document.getElementById("listaMedico");
const modeloMedico = document.getElementById("modeloMedico");
const mensagemPainel = document.getElementById("mensagemPainel");

async function carregarPainelMedico() {

    if (!listaMedico || !modeloMedico) {
        return;
    }

    try {

        // Lista quem aguarda o médico E quem ele já começou a atender
        // (continua na lista até dar alta ou cancelar)
        const resposta = await fetch("/api/medico/fila");

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {

            mostrarMensagem(mensagemPainel,
                dados.mensagem || "Não foi possível carregar os atendimentos.");

            return;
        }

        listaMedico.innerHTML = "";

        dados.atendimentos.forEach(function (atendimento) {

            const linha = modeloMedico.content.cloneNode(true);

            linha.querySelector(".fila-numero").textContent =
                atendimento.numero;

            linha.querySelector(".fila-nome").textContent =
                atendimento.nome;

            linha.querySelector(".fila-nascimento").textContent =
                atendimento.dataNascimento
                    ? new Date(
                        atendimento.dataNascimento + "T00:00:00"
                    ).toLocaleDateString("pt-BR")
                    : "Não informado";

            linha.querySelector(".fila-cor").textContent =
                atendimento.classificacao;

            pintarSelo(linha.querySelector(".fila-cor"), atendimento.classificacao);

            // Coloca o número do atendimento no botão Acessar
            linha.querySelector(".fila-acessar").href =
                "atendimento-medico.html?numero=" +
                encodeURIComponent(atendimento.numero);

            const emAndamento = atendimento.status === "EM_ATENDIMENTO";

            if (emAndamento) {
                linha.querySelector(".fila-acessar").textContent = "Continuar";
            }

            // Quando o médico clicar em Acessar
            linha.querySelector(".fila-acessar").addEventListener(
                "click",
                async function (evento) {

                    evento.preventDefault();

                    const numero = atendimento.numero;

                    // Já está em atendimento: só reabre a tela do médico
                    if (emAndamento) {
                        window.location.href =
                            "atendimento-medico.html?numero=" +
                            encodeURIComponent(numero);
                        return;
                    }

                    try {

                        const respostaAtender = await fetch(
                            "/api/medico/atender/" +
                            encodeURIComponent(numero),
                            {
                                method: "POST"
                            }
                        );

                        const dadosAtender =
                            await lerResposta(respostaAtender);

                        if (!respostaAtender.ok) {

                            alert(
                                dadosAtender.mensagem ||
                                "Não foi possível iniciar o atendimento."
                            );

                            return;
                        }

                        // Depois que o servidor mudou para
                        // EM_ATENDIMENTO, abre a tela do médico
                        window.location.href =
                            "atendimento-medico.html?numero=" +
                            encodeURIComponent(numero);

                    } catch (erro) {

                        console.error(
                            "Erro ao iniciar atendimento médico:",
                            erro
                        );

                        alert("Erro ao conectar com o servidor.");

                    }

                }
            );

            listaMedico.appendChild(linha);

        });

    } catch (erro) {

        console.error(
            "Erro ao carregar painel do médico:",
            erro
        );

        mostrarMensagem(mensagemPainel, "Erro ao conectar com o servidor.");

    }

}

carregarPainelMedico();


// --- Fila do médico com botão "Confirmar e registrar alta" ---

const filaMedica = document.getElementById("filaMedica");

if (filaMedica) {

    const mensagemFilaMedica = document.getElementById("mensagemFilaMedica");

    let carregandoFilaMedica = false;

    const atualizarFilaMedica = async function () {

        if (carregandoFilaMedica) {
            return;
        }

        carregandoFilaMedica = true;

        try {
            const { atendimentos } = await api("/api/medico/fila");

            filaMedica.replaceChildren();

            atendimentos.forEach(function (atendimento) {

                const item = document.createElement("li");
                const botao = document.createElement("button");

                botao.className = "botao";
                botao.textContent = "Confirmar e registrar alta";

                botao.addEventListener("click", async function () {

                    botao.disabled = true;

                    try {
                        const numero = encodeURIComponent(atendimento.numero);

                        // Aguardando médico -> Em atendimento -> Confirmado / Alta
                        if (atendimento.status !== "EM_ATENDIMENTO") {
                            await enviarJSON("/api/medico/atender/" + numero, "POST", {});
                        }

                        await enviarJSON("/api/medico/alta/" + numero, "POST", {});

                        await atualizarFilaMedica();

                    } catch (erro) {
                        mostrarMensagem(mensagemFilaMedica, erro.message);
                        botao.disabled = false;
                    }
                });

                const detalhes = [
                    atendimento.cor || atendimento.classificacao || "",
                    atendimento.numero,
                    atendimento.nome
                ];

                if (atendimento.dataHoraTriagem) {
                    detalhes.push(
                        new Date(atendimento.dataHoraTriagem).toLocaleString("pt-BR")
                    );
                }

                item.append(
                    detalhes.join(" | "),
                    document.createElement("br"),
                    botao
                );

                filaMedica.append(item);
            });

            mostrarMensagem(
                mensagemFilaMedica,
                atendimentos.length ? "" : "Nenhum atendimento aguardando o médico."
            );

        } catch (erro) {
            mostrarMensagem(mensagemFilaMedica, erro.message);

        } finally {
            carregandoFilaMedica = false;
        }
    };

    const botaoAtualizarFilaMedica =
        document.getElementById("atualizarFilaMedica");

    if (botaoAtualizarFilaMedica) {
        botaoAtualizarFilaMedica.addEventListener("click", atualizarFilaMedica);
    }

    atualizarFilaMedica();

    setInterval(atualizarFilaMedica, 15000);
}


// ============================================================
// H06 - CONSULTA E CANCELAMENTO DE ATENDIMENTOS
// (pelo número ou pelo CPF)
// ============================================================

const formConsultaAtendimento =
    document.getElementById("formConsultaAtendimento");

const listaAtendimentos =
    document.getElementById("listaAtendimentos");

const modeloAtendimento =
    document.getElementById("modeloAtendimento");

const mensagemConsulta =
    document.getElementById("mensagemConsulta");


// Traduz os status para exibição
const nomesSituacao = {
    ABERTO: "Aberto",
    AGUARDANDO_TRIAGEM: "Aguardando triagem",
    AGUARDANDO_MEDICO: "Aguardando médico",
    EM_ATENDIMENTO: "Em atendimento",
    CONFIRMADO: "Confirmado / Alta",
    CANCELADO: "Cancelado"
};


// Consulta atendimento pelo número ou CPF
async function consultarAtendimentos() {

    if (!formConsultaAtendimento) {
        return;
    }

    const busca = document.getElementById("busca").value.trim();

    const buscaLimpa = busca.replace(/\D/g, "");

    const ehNumero = /^AT\d+$/i.test(busca);
    const ehCpf = /^\d{11}$/.test(buscaLimpa);

    if (!ehNumero && !ehCpf) {
        mensagemConsulta.textContent =
            "Digite o número do atendimento (ex: AT0001) ou um CPF com 11 dígitos.";

        listaAtendimentos.innerHTML = "";

        return;
    }

    const valorBusca = ehNumero ? busca.toUpperCase() : buscaLimpa;

    mensagemConsulta.textContent = "Consultando atendimento...";
    listaAtendimentos.innerHTML = "";

    try {

        const resposta = await fetch(
            "/api/atendimentos/" + encodeURIComponent(valorBusca)
        );

        const dados = await lerResposta(resposta);

        if (!resposta.ok) {

            mensagemConsulta.textContent =
                dados.mensagem || "Não foi possível consultar o atendimento.";

            return;
        }

        listaAtendimentos.innerHTML = "";

        // Um card para cada atendimento encontrado
        dados.atendimentos.forEach(function (atendimento) {

            const ficha = modeloAtendimento.content.cloneNode(true);

            const artigo = ficha.querySelector(".ficha-atendimento") || ficha;

            artigo.querySelector(".ficha-numero").textContent =
                atendimento.numero;

            artigo.querySelector(".situacao").textContent =
                nomesSituacao[atendimento.status] || atendimento.status;

            artigo.querySelector(".ficha-nome").textContent =
                atendimento.nome;

            artigo.querySelector(".ficha-cpf").textContent =
                atendimento.cpf;

            artigo.querySelector(".ficha-chegada").textContent =
                atendimento.dataHoraChegada
                    ? new Date(atendimento.dataHoraChegada).toLocaleString("pt-BR")
                    : "Não informada";


            const motivo = artigo.querySelector(".ficha-motivo");

            const textoMotivo =
                artigo.querySelector(".ficha-motivo-texto");

            const botaoCancelar =
                artigo.querySelector(".ficha-cancelar");

            const linkAlterar =
                artigo.querySelector(".ficha-alterar");

            const formularioCancelamento =
                artigo.querySelector(".ficha-cancelamento");

            const campoMotivo =
                artigo.querySelector(".ficha-motivo-campo");

            const botaoVoltar =
                artigo.querySelector(".ficha-voltar");

            const mensagemRecusa =
                artigo.querySelector(".ficha-recusa");

            const temCancelamento =
                botaoCancelar && formularioCancelamento && campoMotivo &&
                botaoVoltar && mensagemRecusa;


            // Leva o número para a tela de alteração
            if (linkAlterar) {
                linkAlterar.href =
                    "alterar-atendimento.html?numero=" +
                    encodeURIComponent(atendimento.numero);
            }


            const statusBloqueadoCancelamento = [
                "CANCELADO",
                "EM_ATENDIMENTO",
                "CONFIRMADO"
            ].includes(atendimento.status);

            // Se já estiver cancelado, exibe o motivo registrado
            if (atendimento.status === "CANCELADO") {

                if (motivo) {
                    motivo.hidden = false;
                }

                if (textoMotivo) {
                    textoMotivo.textContent =
                        atendimento.motivoCancelamento || "Não informado";
                }

                if (botaoCancelar) {
                    botaoCancelar.hidden = true;
                }

                if (linkAlterar) {
                    linkAlterar.hidden = true;
                }

                if (formularioCancelamento) {
                    formularioCancelamento.hidden = true;
                }

            } else {

                if (motivo) {
                    motivo.hidden = true;
                }

                // Não permite cancelar depois que o médico assumiu ou finalizou
                if (
                    temCancelamento &&
                    (atendimento.status === "EM_ATENDIMENTO" ||
                     atendimento.status === "CONFIRMADO")
                ) {

                    botaoCancelar.hidden = true;
                    mensagemRecusa.textContent =
                        "Não é possível cancelar: o médico já assumiu ou finalizou este atendimento.";

                }

                // Só permite alterar atendimentos não finalizados
                if (linkAlterar && atendimento.status === "CONFIRMADO") {
                    linkAlterar.hidden = true;
                }

            }


            if (temCancelamento) {

                // Abre o formulário de cancelamento apenas se o status permitir
                botaoCancelar.addEventListener("click", function () {

                    if (statusBloqueadoCancelamento) {
                        botaoCancelar.hidden = true;
                        formularioCancelamento.hidden = true;
                        if (!mensagemRecusa.textContent) {
                            mensagemRecusa.textContent =
                                "Não é possível registrar cancelamento para este atendimento.";
                        }
                        return;
                    }

                    formularioCancelamento.hidden = false;

                    botaoCancelar.hidden = true;

                    campoMotivo.focus();

                });


                // Volta sem cancelar
                botaoVoltar.addEventListener("click", function () {

                    formularioCancelamento.hidden = true;

                    botaoCancelar.hidden = false;

                    campoMotivo.value = "";

                    mensagemRecusa.textContent = "";

                });


                // Confirma o cancelamento
                formularioCancelamento.addEventListener(
                    "submit",
                    async function (evento) {

                        evento.preventDefault();

                        const motivoInformado = campoMotivo.value.trim();

                        mensagemRecusa.textContent = "";

                        if (!motivoInformado) {

                            mensagemRecusa.textContent =
                                "Informe o motivo do cancelamento.";

                            campoMotivo.focus();

                            return;
                        }

                        const botaoConfirmar =
                            formularioCancelamento.querySelector(
                                'button[type="submit"]'
                            );

                        botaoConfirmar.disabled = true;

                        try {

                            const respostaCancelamento = await fetch(
                                "/api/atendimentos/" +
                                encodeURIComponent(atendimento.numero) +
                                "/cancelar",
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type": "application/json"
                                    },

                                    body: JSON.stringify({
                                        motivo: motivoInformado
                                    })
                                }
                            );

                            const dadosCancelamento =
                                await lerResposta(respostaCancelamento);

                            if (!respostaCancelamento.ok) {

                                mensagemRecusa.textContent =
                                    dadosCancelamento.mensagem ||
                                    "Não foi possível cancelar o atendimento.";

                                return;
                            }

                            alert(dadosCancelamento.mensagem);

                            // Atualiza a consulta para mostrar o status
                            // Cancelado e o motivo informado
                            await consultarAtendimentos();

                        } catch (erro) {

                            console.error(
                                "Erro ao cancelar atendimento:",
                                erro
                            );

                            mensagemRecusa.textContent =
                                "Erro ao conectar com o servidor.";

                        } finally {

                            botaoConfirmar.disabled = false;

                        }

                    }
                );

            }


            listaAtendimentos.appendChild(ficha);

        });

        mensagemConsulta.textContent =
            dados.atendimentos.length === 1
                ? "1 atendimento encontrado."
                : dados.atendimentos.length + " atendimentos encontrados.";

    } catch (erro) {

        console.error("Erro ao consultar atendimentos:", erro);

        mensagemConsulta.textContent =
            "Erro ao conectar com o servidor.";

    }

}


if (formConsultaAtendimento) {

    formConsultaAtendimento.addEventListener(
        "submit",
        function (evento) {

            evento.preventDefault();

            consultarAtendimentos();

        }
    );

}


// ============================================================
// CONSULTA + EDIÇÃO DE ATENDIMENTO NA MESMA TELA
// (formulário "consultaAtendimentos" com editor embutido)
// ============================================================

const consultaAtendimentos = document.getElementById("consultaAtendimentos");
const editorAtendimento = document.getElementById("editorAtendimento");

if (consultaAtendimentos && editorAtendimento) {

    const entrada = document.getElementById("buscaAtendimento");
    const mensagem = document.getElementById("mensagemConsultaAtendimentos");
    const lista = document.getElementById("resultadosAtendimentos");
    const editor = editorAtendimento;
    const controleStatus = editor.elements.status;
    const motivo = editor.elements.motivoCancelamento;

    let atendimentoAtual;

    function normalizarBusca(valor) {
        const texto = valor.trim();

        return /^AT\d+$/i.test(texto)
            ? texto.toUpperCase()
            : texto.replace(/\D/g, "");
    }

    function mostrarResultados(atendimentos) {

        lista.replaceChildren();

        for (const atendimento of atendimentos) {

            const item = document.createElement("li");

            const dados = [
                atendimento.numero,
                atendimento.nome,
                atendimento.cpf,
                nomesSituacao[atendimento.status] || atendimento.status,
                "Observações: " + (atendimento.observacoes || "—"),
                "Orientações: " + (atendimento.orientacoes || "—")
            ];

            if (atendimento.dataHoraAlta) {
                dados.push("Alta: " +
                    new Date(atendimento.dataHoraAlta).toLocaleString("pt-BR"));
            }

            if (atendimento.dataHoraCancelamento) {
                dados.push("Cancelamento: " +
                    new Date(atendimento.dataHoraCancelamento).toLocaleString("pt-BR"));
            }

            if (atendimento.motivoCancelamento) {
                dados.push("Motivo: " + atendimento.motivoCancelamento);
            }

            const botao = document.createElement("button");

            botao.type = "button";
            botao.className = "botao botao-secundario";
            botao.textContent = "Editar " + atendimento.numero;

            botao.addEventListener("click", function () {

                atendimentoAtual = atendimento;

                const legenda = editor.querySelector("legend");

                if (legenda) {
                    legenda.textContent = "Editar " + atendimento.numero;
                }

                editor.elements.cpfPaciente.value = atendimento.cpf;
                editor.elements.observacoes.value = atendimento.observacoes || "";
                editor.elements.orientacoes.value = atendimento.orientacoes || "";
                motivo.value = atendimento.motivoCancelamento || "";
                controleStatus.value = atendimento.status;
                controleStatus.disabled = atendimento.status !== "ABERTO";
                controleStatus.dispatchEvent(new Event("change"));

                editor.hidden = false;
                editor.elements.cpfPaciente.focus();
            });

            item.append(dados.join(" | "), document.createElement("br"), botao);
            lista.append(item);
        }
    }

    controleStatus.addEventListener("change", function () {

        const cancelado = controleStatus.value === "CANCELADO";

        motivo.closest("label").hidden = !cancelado;

        motivo.required = cancelado &&
            (!controleStatus.disabled ||
             Boolean(atendimentoAtual && atendimentoAtual.motivoCancelamento));
    });

    consultaAtendimentos.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        editor.hidden = true;
        lista.replaceChildren();
        mensagem.textContent = "Buscando...";

        try {
            const { atendimentos } = await api(
                "/api/atendimentos/" + encodeURIComponent(normalizarBusca(entrada.value))
            );

            mostrarResultados(atendimentos);

            mensagem.textContent = "";

        } catch (erro) {
            mensagem.textContent = erro.message;
        }
    });

    editor.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const atendimento = atendimentoAtual;

        if (!atendimento) {
            return;
        }

        const botao = evento.submitter ||
            editor.querySelector('button[type="submit"]');

        if (botao) {
            botao.disabled = true;
        }

        try {

            const numero = encodeURIComponent(atendimento.numero);

            const cpf = limparCPF(editor.elements.cpfPaciente.value);

            if (!/^\d{11}$/.test(cpf)) {
                throw new Error("Informe um CPF com 11 dígitos.");
            }

            const observacoes = editor.elements.observacoes.value.trim() || null;
            const orientacoes = editor.elements.orientacoes.value.trim() || null;
            const motivoTexto = motivo.value.trim();
            const novoStatus = controleStatus.value;

            const mudouStatus =
                !controleStatus.disabled && novoStatus !== atendimento.status;

            if (mudouStatus && novoStatus === "CANCELADO" && !motivoTexto) {
                throw new Error("Informe o motivo do cancelamento.");
            }

            // 1) Paciente (CPF) e observações -> PUT /api/atendimentos/:numero
            if (cpf !== limparCPF(atendimento.cpf) ||
                observacoes !== (atendimento.observacoes ?? null)) {

                await enviarJSON("/api/atendimentos/" + numero, "PUT", {
                    cpf: cpf,
                    dataHoraChegada: paraDataHoraLocal(atendimento.dataHoraChegada),
                    observacoes: observacoes
                });
            }

            // 2) Orientações -> POST /api/medico/medicacoes/:numero
            if (orientacoes && orientacoes !== (atendimento.orientacoes ?? null)) {

                await enviarJSON("/api/medico/medicacoes/" + numero, "POST", {
                    orientacoes: orientacoes
                });
            }

            // 3) Mudança de status
            if (mudouStatus) {

                if (novoStatus === "CANCELADO") {

                    await enviarJSON(
                        "/api/atendimentos/" + numero + "/cancelar",
                        "POST",
                        { motivo: motivoTexto }
                    );

                } else if (novoStatus === "CONFIRMADO") {

                    await enviarJSON("/api/medico/alta/" + numero, "POST", {});

                } else {

                    throw new Error(
                        "Não é possível alterar o status para esta situação por aqui."
                    );
                }
            }

            // Recarrega os dados atualizados do servidor
            const { atendimentos } = await api("/api/atendimentos/" + numero);

            entrada.value = atendimento.numero;

            mostrarResultados(atendimentos);

            editor.hidden = true;

            mensagem.textContent = "Atendimento salvo.";

        } catch (erro) {

            mensagem.textContent =
                erro.status === 404 && /paciente/i.test(erro.message)
                    ? "CPF do paciente não cadastrado."
                    : erro.message;

        } finally {

            if (botao) {
                botao.disabled = false;
            }
        }
    });
}


// ============================================================
// TELA DO MÉDICO (atendimento-medico.html)
// Mostra paciente + triagem, grava medicações/orientações e dá alta
// ============================================================

const formPrescricao = document.getElementById("formPrescricao");

if (formPrescricao) {

    const numeroMedicoURL =
        new URLSearchParams(window.location.search).get("numero") || "";

    const mensagemTela = document.getElementById("mensagemAtendimentoMedico");
    const mensagemMedicacoes = document.getElementById("mensagemMedicacoes");
    const mensagemPrescricao = document.getElementById("mensagemPrescricao");
    const mensagemAlta = document.getElementById("mensagemAlta");

    const corpoMedicacoes = document.getElementById("listaMedicacoes");
    const modeloMedicacao = document.getElementById("modeloMedicacao");

    const campoNomeMedicacao = document.getElementById("nomeMedicacao");
    const campoPosologia = document.getElementById("posologiaMedicacao");
    const campoOrientacoes = document.getElementById("orientacoes");

    const botaoAdicionar = document.getElementById("botaoAdicionarMedicacao");
    const botaoAlta = document.getElementById("botaoConfirmarAlta");

    let atendimentoMedico = null;
    let novasMedicacoes = [];          // ainda não gravadas no banco
    let orientacoesSalvas = "";

    const escrever = function (id, valor) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = valor;
        }
    };

    const calcularIdade = function (dataIso) {

        if (!dataIso) {
            return "Não informada";
        }

        const partes = String(dataIso).slice(0, 10).split("-").map(Number);
        const hoje = new Date();

        let idade = hoje.getFullYear() - partes[0];

        const mes = hoje.getMonth() + 1;

        if (mes < partes[1] || (mes === partes[1] && hoje.getDate() < partes[2])) {
            idade--;
        }

        return idade + " anos";
    };

    const bloquearTela = function () {
        formPrescricao.querySelectorAll("input, textarea, button").forEach(
            function (campo) {
                campo.disabled = true;
            }
        );

        botaoAlta.disabled = true;

        // Atendimento já encerrado ou indisponível: some o cancelamento
        const blocoCancelamento = document.getElementById("cancelamentoMedico");

        if (blocoCancelamento) {
            blocoCancelamento.hidden = true;
        }
    };

    const mostrarAlta = function (dataHora) {
        document.getElementById("altaRegistrada").hidden = false;

        escrever(
            "dataHoraAlta",
            dataHora ? new Date(dataHora).toLocaleString("pt-BR") : "agora"
        );
    };

    // Desenha a tabela: medicações já gravadas + as novas (ainda não salvas)
    const desenharMedicacoes = function () {

        corpoMedicacoes.replaceChildren();

        const salvas = atendimentoMedico.medicacoes || [];

        const adicionarLinha = function (medicacao, indiceNova) {

            const linha = modeloMedicacao.content.cloneNode(true);

            linha.querySelector(".med-nome").textContent =
                indiceNova === null
                    ? medicacao.nome
                    : medicacao.nome + " (não salva)";

            linha.querySelector(".med-posologia").textContent =
                medicacao.posologia || "—";

            const botaoRemover = linha.querySelector(".remover-medicacao");

            if (indiceNova === null) {
                // O servidor não tem rota para apagar medicação já gravada
                botaoRemover.hidden = true;

            } else {
                botaoRemover.addEventListener("click", function () {
                    novasMedicacoes.splice(indiceNova, 1);
                    desenharMedicacoes();
                });
            }

            corpoMedicacoes.appendChild(linha);
        };

        salvas.forEach(function (medicacao) {
            adicionarLinha(medicacao, null);
        });

        novasMedicacoes.forEach(function (medicacao, indice) {
            adicionarLinha(medicacao, indice);
        });

        mostrarMensagem(
            mensagemMedicacoes,
            salvas.length + novasMedicacoes.length === 0
                ? "Nenhuma medicação registrada."
                : ""
        );
    };

    const preencherTela = function (atendimento) {

        atendimentoMedico = atendimento;

        escrever("numeroMedico", atendimento.numero);
        escrever("classificacaoMedico", atendimento.classificacao || "Sem triagem");
        pintarSelo(document.getElementById("classificacaoMedico"), atendimento.classificacao);
        escrever("nomeMedico", atendimento.nome);
        escrever("cpfMedico", atendimento.cpf);

        escrever(
            "nascimentoMedico",
            atendimento.dataNascimento
                ? new Date(atendimento.dataNascimento + "T00:00:00")
                    .toLocaleDateString("pt-BR")
                : "Não informado"
        );

        escrever("idadeMedico", calcularIdade(atendimento.dataNascimento));

        escrever(
            "chegadaMedico",
            atendimento.dataHoraChegada
                ? new Date(atendimento.dataHoraChegada).toLocaleString("pt-BR")
                : "Não informada"
        );

        escrever("pressaoMedico", atendimento.pressaoArterial || "Não informada");
        escrever("temperaturaMedico", atendimento.temperatura || "Não informada");
        escrever("batimentosMedico", atendimento.batimentosCardiacos || "Não informado");

        escrever(
            "dataTriagemMedico",
            atendimento.dataHoraTriagem
                ? new Date(atendimento.dataHoraTriagem).toLocaleString("pt-BR")
                : "Não informada"
        );

        escrever("queixasMedico", atendimento.principaisQueixas || "Não informadas");

        orientacoesSalvas = atendimento.orientacoes || "";
        campoOrientacoes.value = orientacoesSalvas;

        desenharMedicacoes();
    };

    const carregarAtendimentoMedico = async function () {

        if (!numeroMedicoURL) {
            mostrarMensagem(mensagemTela, "Atendimento não informado.");
            bloquearTela();
            return;
        }

        try {
            const { atendimento } = await api(
                "/api/triagem/" + encodeURIComponent(numeroMedicoURL)
            );

            preencherTela(atendimento);

            if (atendimento.status === "CONFIRMADO") {

                mostrarAlta(atendimento.dataHoraAlta);
                bloquearTela();

            } else if (atendimento.status !== "EM_ATENDIMENTO") {

                mostrarMensagem(
                    mensagemTela,
                    "Este atendimento está como \"" +
                    (nomesSituacao[atendimento.status] || atendimento.status) +
                    "\". Só é possível registrar medicações e alta quando ele está \"Em atendimento\"."
                );

                bloquearTela();
            }

        } catch (erro) {
            console.error("Erro ao carregar atendimento médico:", erro);

            mostrarMensagem(mensagemTela, erro.message);
            bloquearTela();
        }
    };

    // Põe na lista o que está digitado nos campos (sem gravar ainda)
    const incluirMedicacaoDigitada = function () {

        const nome = campoNomeMedicacao.value.trim();
        const posologia = campoPosologia.value.trim();

        if (!nome) {
            if (posologia) {
                mostrarMensagem(mensagemMedicacoes, "Informe o nome da medicação.");
                campoNomeMedicacao.focus();
                return false;
            }

            return true;
        }

        novasMedicacoes.push({ nome: nome, posologia: posologia });

        campoNomeMedicacao.value = "";
        campoPosologia.value = "";

        desenharMedicacoes();

        return true;
    };

    botaoAdicionar.addEventListener("click", function () {

        if (!campoNomeMedicacao.value.trim()) {
            mostrarMensagem(mensagemMedicacoes, "Informe o nome da medicação.");
            campoNomeMedicacao.focus();
            return;
        }

        incluirMedicacaoDigitada();
        campoNomeMedicacao.focus();
    });

    // Enter nos campos adiciona a medicação (em vez de enviar o formulário)
    [campoNomeMedicacao, campoPosologia].forEach(function (campo) {
        campo.addEventListener("keydown", function (evento) {
            if (evento.key === "Enter") {
                evento.preventDefault();
                botaoAdicionar.click();
            }
        });
    });

    // Salvar medicações e orientações
    formPrescricao.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        if (!atendimentoMedico) {
            return;
        }

        mostrarMensagem(mensagemPrescricao, "");

        if (!incluirMedicacaoDigitada()) {
            return;
        }

        const orientacoes = campoOrientacoes.value.trim();

        if (novasMedicacoes.length === 0 && orientacoes === orientacoesSalvas) {
            mostrarMensagem(mensagemPrescricao, "Não há alterações para salvar.");
            return;
        }

        if (novasMedicacoes.length === 0 && !orientacoes) {
            mostrarMensagem(
                mensagemPrescricao,
                "Informe ao menos uma medicação ou as orientações."
            );
            return;
        }

        const botaoSalvarPrescricao =
            formPrescricao.querySelector('button[type="submit"]');

        botaoSalvarPrescricao.disabled = true;

        mostrarMensagem(mensagemPrescricao, "Salvando...");

        try {
            const dados = await enviarJSON(
                "/api/medico/medicacoes/" + encodeURIComponent(atendimentoMedico.numero),
                "POST",
                {
                    medicacoes: novasMedicacoes,
                    orientacoes: orientacoes
                }
            );

            novasMedicacoes = [];

            preencherTela(dados.atendimento);

            mostrarMensagem(
                mensagemPrescricao,
                "Medicações e orientações salvas com sucesso!"
            );

        } catch (erro) {
            console.error("Erro ao salvar medicações:", erro);

            mostrarMensagem(mensagemPrescricao, erro.message);

        } finally {
            botaoSalvarPrescricao.disabled = false;
        }
    });

    // Confirmar atendimento e registrar alta
    botaoAlta.addEventListener("click", async function () {

        if (!atendimentoMedico) {
            return;
        }

        mostrarMensagem(mensagemAlta, "");

        const temPendencia =
            novasMedicacoes.length > 0 ||
            campoNomeMedicacao.value.trim() !== "" ||
            campoOrientacoes.value.trim() !== orientacoesSalvas;

        if (temPendencia) {
            mostrarMensagem(
                mensagemAlta,
                "Salve as medicações e orientações antes de confirmar a alta."
            );
            return;
        }

        if (!confirm(
            "Confirmar o atendimento e registrar a alta? " +
            "Depois disso não será possível alterar."
        )) {
            return;
        }

        botaoAlta.disabled = true;

        try {
            const dados = await enviarJSON(
                "/api/medico/alta/" + encodeURIComponent(atendimentoMedico.numero),
                "POST",
                {}
            );

            mostrarAlta(dados.atendimento.dataHoraAlta);
            bloquearTela();

        } catch (erro) {
            console.error("Erro ao registrar alta:", erro);

            mostrarMensagem(mensagemAlta, erro.message);

            botaoAlta.disabled = false;
        }
    });

    carregarAtendimentoMedico();
}


// ============================================================
// RECLASSIFICAR (reclassificar.html)
// Só enquanto o atendimento está Aguardando médico
// ============================================================

const formReclassificacao = document.getElementById("formReclassificacao");

if (formReclassificacao) {

    const numeroReclassificarURL =
        new URLSearchParams(window.location.search).get("numero") || "";

    const mensagemReclassificacao =
        document.getElementById("mensagemReclassificacao");

    const botaoReclassificar =
        formReclassificacao.querySelector('button[type="submit"]');

    let atendimentoReclassificar = null;

    const bloquearReclassificacao = function () {
        formReclassificacao.querySelectorAll("input, button").forEach(
            function (campo) {
                campo.disabled = true;
            }
        );
    };

    const carregarReclassificacao = async function () {

        if (!numeroReclassificarURL) {
            mostrarMensagem(mensagemReclassificacao, "Atendimento não informado.");
            bloquearReclassificacao();
            return;
        }

        try {
            const { atendimento } = await api(
                "/api/triagem/" + encodeURIComponent(numeroReclassificarURL)
            );

            atendimentoReclassificar = atendimento;

            document.getElementById("numeroReclassificacao").textContent =
                atendimento.numero;

            document.getElementById("nomeReclassificacao").textContent =
                atendimento.nome;

            document.getElementById("classificacaoAtual").textContent =
                atendimento.classificacao || "Sem triagem";

            pintarSelo(document.getElementById("classificacaoAtual"), atendimento.classificacao);

            const campoId = document.getElementById("ID_ATENDIMENTO");

            if (campoId) {
                campoId.value = atendimento.id;
            }

            definirClassificacaoManchester(atendimento.classificacao);

            if (atendimento.status !== "AGUARDANDO_MEDICO") {

                mostrarMensagem(
                    mensagemReclassificacao,
                    "Não é possível reclassificar: o atendimento está como \"" +
                    (nomesSituacao[atendimento.status] || atendimento.status) +
                    "\"."
                );

                bloquearReclassificacao();
            }

        } catch (erro) {
            console.error("Erro ao carregar reclassificação:", erro);

            mostrarMensagem(mensagemReclassificacao, erro.message);
            bloquearReclassificacao();
        }
    };

    formReclassificacao.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        if (!atendimentoReclassificar) {
            return;
        }

        const novaClassificacao = lerClassificacaoManchester();

        if (!novaClassificacao) {
            mostrarMensagem(mensagemReclassificacao, "Selecione a nova classificação.");
            return;
        }

        if (novaClassificacao.toUpperCase() ===
            String(atendimentoReclassificar.classificacao || "").toUpperCase()) {

            mostrarMensagem(
                mensagemReclassificacao,
                "Escolha uma classificação diferente da atual."
            );
            return;
        }

        botaoReclassificar.disabled = true;

        mostrarMensagem(mensagemReclassificacao, "Salvando...");

        try {
            // O servidor regrava a triagem inteira: reenvia os dados atuais
            // para não apagar pressão, temperatura, batimentos e queixas.
            await enviarJSON("/api/triagem", "POST", {
                idAtendimento: atendimentoReclassificar.id,
                pressaoArterial: atendimentoReclassificar.pressaoArterial,
                temperatura: atendimentoReclassificar.temperatura,
                batimentosCardiacos: atendimentoReclassificar.batimentosCardiacos,
                classificacaoManchester: novaClassificacao,
                principaisQueixas: atendimentoReclassificar.principaisQueixas
            });

            mostrarMensagem(
                mensagemReclassificacao,
                "Classificação alterada com sucesso!"
            );

            // Volta para a fila de triagem, já com a nova cor
            setTimeout(function () {
                window.location.href = "triagem.html";
            }, 1000);

        } catch (erro) {
            console.error("Erro ao reclassificar:", erro);

            mostrarMensagem(mensagemReclassificacao, erro.message);

            botaoReclassificar.disabled = false;
        }
    });

    carregarReclassificacao();
}


// ============================================================
// ALTERAR ATENDIMENTO (alterar-atendimento.html)
// Troca o paciente (CPF) e a data/hora de chegada
// ============================================================

const formAlterarAtendimento = document.getElementById("formAlterarAtendimento");

if (formAlterarAtendimento) {

    const numeroAlterarURL =
        new URLSearchParams(window.location.search).get("numero") || "";

    const mensagemAlteracao = document.getElementById("mensagemAlteracao");
    const campoCPFAlteracao = document.getElementById("cpfPaciente");
    const campoChegada = document.getElementById("dataHoraChegada");

    const botaoAlterar =
        formAlterarAtendimento.querySelector('button[type="submit"]');

    const preencherAlteracao = function (atendimento) {

        document.getElementById("numeroAlteracao").textContent =
            atendimento.numero;

        document.getElementById("nomeAlteracao").textContent =
            atendimento.nome;

        document.getElementById("situacaoAlteracao").textContent =
            nomesSituacao[atendimento.status] || atendimento.status;

        campoCPFAlteracao.value = atendimento.cpf;

        // O campo datetime-local quer "AAAA-MM-DDTHH:MM"
        campoChegada.value =
            paraDataHoraLocal(atendimento.dataHoraChegada).slice(0, 16);
    };

    const carregarAlteracao = async function () {

        if (!numeroAlterarURL) {
            mostrarMensagem(mensagemAlteracao, "Atendimento não informado.");
            formAlterarAtendimento.hidden = true;
            return;
        }

        try {
            const { atendimentos } = await api(
                "/api/atendimentos/" + encodeURIComponent(numeroAlterarURL)
            );

            const atendimento = atendimentos[0];

            preencherAlteracao(atendimento);

            const ID = document.getElementById("ID_ATENDIMENTO");

            if (ID) {
                ID.value = atendimento.numero;
            }

            // Confirmado ou cancelado: não pode mais alterar
            if (atendimento.status === "CONFIRMADO" ||
                atendimento.status === "CANCELADO") {

                document.getElementById("recusaAlteracao").hidden = false;

                if (atendimento.status === "CANCELADO") {
                    document.getElementById("mensagemRecusa").textContent =
                        "Este atendimento foi cancelado e não pode mais ser alterado.";
                }

                formAlterarAtendimento.hidden = true;
            }

        } catch (erro) {
            console.error("Erro ao carregar atendimento:", erro);

            mostrarMensagem(mensagemAlteracao, erro.message);
            formAlterarAtendimento.hidden = true;
        }
    };

    formAlterarAtendimento.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const cpf = limparCPF(campoCPFAlteracao.value);

        if (!/^\d{11}$/.test(cpf)) {
            mostrarMensagem(mensagemAlteracao, "Informe um CPF com 11 dígitos.");
            return;
        }

        if (!campoChegada.value) {
            mostrarMensagem(mensagemAlteracao, "Informe a data e hora da chegada.");
            return;
        }

        botaoAlterar.disabled = true;

        mostrarMensagem(mensagemAlteracao, "Salvando alterações...");

        try {
            const dados = await enviarJSON(
                "/api/atendimentos/" + encodeURIComponent(numeroAlterarURL),
                "PUT",
                {
                    cpf: cpf,
                    dataHoraChegada: campoChegada.value
                }
            );

            preencherAlteracao(dados.atendimento);

            mostrarMensagem(mensagemAlteracao, "Atendimento alterado com sucesso!");

        } catch (erro) {
            console.error("Erro ao alterar atendimento:", erro);

            mostrarMensagem(mensagemAlteracao, erro.message);

        } finally {
            botaoAlterar.disabled = false;
        }
    });

    carregarAlteracao();
}


// ============================================================
// CANCELAR ATENDIMENTO PELO MÉDICO (atendimento-medico.html)
// Pede o motivo e volta para o painel do médico
// ============================================================

const cancelamentoMedico = document.getElementById("cancelamentoMedico");

if (cancelamentoMedico) {

    const numeroCancelarMedico =
        new URLSearchParams(window.location.search).get("numero") || "";

    const botaoAbrirCancelamento =
        document.getElementById("botaoAbrirCancelamento");

    const formCancelamentoMedico =
        document.getElementById("formCancelamentoMedico");

    const campoMotivoMedico =
        document.getElementById("motivoCancelamentoMedico");

    const botaoVoltarCancelamento =
        document.getElementById("botaoVoltarCancelamento");

    const mensagemCancelamentoMedico =
        document.getElementById("mensagemCancelamentoMedico");

    botaoAbrirCancelamento.addEventListener("click", function () {

        formCancelamentoMedico.hidden = false;

        botaoAbrirCancelamento.hidden = true;

        campoMotivoMedico.focus();
    });

    botaoVoltarCancelamento.addEventListener("click", function () {

        formCancelamentoMedico.hidden = true;

        botaoAbrirCancelamento.hidden = false;

        campoMotivoMedico.value = "";

        mostrarMensagem(mensagemCancelamentoMedico, "");
    });

    formCancelamentoMedico.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const motivo = campoMotivoMedico.value.trim();

        if (!motivo) {
            mostrarMensagem(
                mensagemCancelamentoMedico,
                "Informe o motivo do cancelamento."
            );
            campoMotivoMedico.focus();
            return;
        }

        if (!confirm("Cancelar este atendimento? Essa ação não pode ser desfeita.")) {
            return;
        }

        const botaoConfirmarCancelamento =
            formCancelamentoMedico.querySelector('button[type="submit"]');

        botaoConfirmarCancelamento.disabled = true;

        mostrarMensagem(mensagemCancelamentoMedico, "Cancelando...");

        try {
            await enviarJSON(
                "/api/atendimentos/" +
                encodeURIComponent(numeroCancelarMedico) + "/cancelar",
                "POST",
                { motivo: motivo, origem: "medico" }
            );

            mostrarMensagem(
                mensagemCancelamentoMedico,
                "Atendimento cancelado com sucesso!"
            );

            setTimeout(function () {
                window.location.href = "medico.html";
            }, 1000);

        } catch (erro) {
            console.error("Erro ao cancelar atendimento:", erro);

            mostrarMensagem(mensagemCancelamentoMedico, erro.message);

            botaoConfirmarCancelamento.disabled = false;
        }
    });
}
