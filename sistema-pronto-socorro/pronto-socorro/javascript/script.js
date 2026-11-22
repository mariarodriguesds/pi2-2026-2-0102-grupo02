
//CONSULTA DE PACIENTES
let idPacienteEncontrado = null;

const formConsulta = document.getElementById("formConsulta");

const resultado = document.getElementById("resultado");

if (formConsulta) {

    formConsulta.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const cpf = document.getElementById("cpf").value.trim();

        const cpfLimpo = cpf.replace(/\D/g, "");

        if (!/^\d{11}$/.test(cpfLimpo)) {

            resultado.textContent = "Informe um CPF com 11 dígitos.";

            return;
        }

        try {

            const resposta = await fetch(
                "/api/paciente/" + encodeURIComponent(cpfLimpo)
            );

            const dados = await resposta.json();

            if (resposta.status === 404) {

                window.location.href = dados.redirecionarPara;

                return;
            }

            if (!resposta.ok) {

                resultado.textContent =
                    dados.mensagem || "Erro ao consultar paciente.";

                return;
            }

            idPacienteEncontrado = dados.paciente.id;

            resultado.textContent =
                "Paciente encontrado! Nome: " + dados.paciente.nome +
                " | CPF: " + dados.paciente.cpf +
                " | Data de nascimento: " +
                (dados.paciente.dataNascimento
                    ? String(dados.paciente.dataNascimento).substring(0, 10)
                    : "Não informada");

        } catch (erro) {

            resultado.textContent = "Erro ao conectar com o servidor.";

            console.error("Erro na consulta:", erro);

        }

    });

}


//CADASTRO DE PACIENTES

const formularioCadastro =
    document.getElementById("formCadastroPaciente");

const mensagemCadastro =
    document.getElementById("mensagem");

if (formularioCadastro) {
    formularioCadastro.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const nome = document.getElementById("nome_completo").value.trim();

        const cpf = document.getElementById("cpf").value;
        const cpfLimpo = cpf.replace(/\D/g, "");

        const rg = document.getElementById("rg").value.trim();

        const dataNascimento =
            document.getElementById("data_nascimento").value;

        const nomePai = document.getElementById("nome_pai").value.trim();
        const nomeMae = document.getElementById("nome_mae").value.trim();
        const endereco = document.getElementById("endereco").value.trim();

        const telefone = document.getElementById("telefone").value.trim();
        const telefoneLimpo = telefone.replace(/\D/g, "");

        mensagemCadastro.textContent = "";

        if (!nome || !cpfLimpo) {
            mensagemCadastro.textContent =
                "Preencha o nome completo e o CPF.";
            return;
        }

        if (!/^\d{11}$/.test(cpfLimpo)) {
            mensagemCadastro.textContent =
                "Informe um CPF com 11 dígitos.";
            return;
        }

        if (dataNascimento) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, "0");
            const dia = String(hoje.getDate()).padStart(2, "0");
            const dataAtual = `${ano}-${mes}-${dia}`;

            if (dataNascimento > dataAtual) {
                mensagemCadastro.textContent =
                    "Informe uma data de nascimento válida.";
                return;
            }
        }

        if (telefoneLimpo && !/^\d{10,11}$/.test(telefoneLimpo)) {
            mensagemCadastro.textContent =
                "Informe um telefone com DDD, contendo 10 ou 11 dígitos.";
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
            mensagemCadastro.textContent = "Cadastrando paciente...";

            const resposta = await fetch("/api/paciente", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(paciente)
            });

            const dados = await resposta.json();

            if (resposta.status === 409) {
                mensagemCadastro.textContent = "CPF já cadastrado.";
                return;
            }

            if (!resposta.ok) {
                mensagemCadastro.textContent =
                    dados.mensagem || "Não foi possível cadastrar o paciente.";
                return;
            }

            mensagemCadastro.textContent =
                "Paciente cadastrado com sucesso!";

            formularioCadastro.reset();

        } catch (erro) {
            mensagemCadastro.textContent =
                "Erro ao conectar com o servidor.";

            console.error("Erro no cadastro:", erro);
        }
    });
}


//EDIÇÃO DE DADOS DO PACIENTE

const formBuscar = document.getElementById("formBuscarPaciente");
const formEditar = document.getElementById("formEditarPaciente");

const campoCPFBusca = document.getElementById("cpfBusca");
const areaEdicao = document.getElementById("areaEdicao");

const mensagemBusca = document.getElementById("mensagemBusca");
const mensagemEdicao = document.getElementById("mensagemEdicao");

const botaoSalvar = document.getElementById("botaoSalvar");
const botaoCancelar = document.getElementById("botaoCancelar");


function limparCPF(cpf) {
    return cpf.replace(/\D/g, "");
}


function mostrarMensagem(elemento, mensagem) {
    elemento.textContent = mensagem;
}


function limparEdicao() {
    formEditar.reset();

    document.getElementById("id_paciente").value = "";

    areaEdicao.hidden = true;

    mostrarMensagem(mensagemEdicao, "");
}


function preencherCampos(paciente) {
    document.getElementById("id_paciente").value =
        paciente.id_paciente;

    document.getElementById("nome_completo").value =
        paciente.nome_completo || "";

    document.getElementById("cpf").value =
        paciente.cpf || "";

    document.getElementById("rg").value =
        paciente.rg || "";

    document.getElementById("data_nascimento").value =
        paciente.data_nascimento
            ? String(paciente.data_nascimento).slice(0, 10)
            : "";

    document.getElementById("nome_pai").value =
        paciente.nome_pai || "";

    document.getElementById("nome_mae").value =
        paciente.nome_mae || "";

    document.getElementById("endereco").value =
        paciente.endereco || "";

    document.getElementById("telefone").value =
        paciente.telefone || "";
}


async function lerResposta(resposta) {
    try {
        return await resposta.json();

    } catch (erro) {
        return {
            mensagem: "Não foi possível interpretar a resposta do servidor."
        };
    }
}


// Buscar paciente pelo CPF
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

        mostrarMensagem(mensagemBusca, "Buscando paciente...");

        try {
            const resposta = await fetch(
                "/api/paciente/" + encodeURIComponent(cpf)
            );

            const dados = await lerResposta(resposta);

            if (!resposta.ok) {
                mostrarMensagem(
                    mensagemBusca,
                    dados.mensagem || "Não foi possível encontrar o paciente."
                );
                return;
            }

            if (!dados.paciente) {
                mostrarMensagem(
                    mensagemBusca,
                    "Paciente não encontrado."
                );
                return;
            }

            preencherCampos(dados.paciente);

            areaEdicao.hidden = false;

            mostrarMensagem(
                mensagemBusca,
                "Paciente encontrado! Você já pode alterar os dados."
            );

        } catch (erro) {
            console.error("Erro ao buscar paciente:", erro);

            mostrarMensagem(
                mensagemBusca,
                "Não foi possível conectar ao servidor. Tente novamente."
            );
        }
    });
}


// Salvar alterações do paciente
if (formEditar) {
    formEditar.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        mostrarMensagem(mensagemEdicao, "");

        const id = document.getElementById("id_paciente").value;

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

        botaoSalvar.disabled = true;

        mostrarMensagem(
            mensagemEdicao,
            "Salvando alterações..."
        );

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

            mostrarMensagem(
                mensagemEdicao,
                "Alterações salvas com sucesso!"
            );

            // Atualiza o CPF usado na próxima busca.
            campoCPFBusca.value = cpf;

        } catch (erro) {
            console.error("Erro ao salvar alterações:", erro);

            mostrarMensagem(
                mensagemEdicao,
                "Não foi possível conectar ao servidor. Tente novamente."
            );

        } finally {
            botaoSalvar.disabled = false;
        }
    });
}


// Cancelar a edição
if (botaoCancelar) {
    botaoCancelar.addEventListener("click", function () {
        limparEdicao();

        mostrarMensagem(
            mensagemBusca,
            "Edição cancelada."
        );
    });
}


// Chamar 'H05.1 - Abre atendimento' ao clicar no botão
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

            const dados = await resposta.json();

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

// H07.2 - Grava a triagem

const formularioTriagem =
    document.getElementById("formTriagem");

if (formularioTriagem) {

    formularioTriagem.addEventListener("submit", async function (evento) {

        evento.preventDefault();

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
                    classificacaoManchester: document.querySelector('input[name="CLASSIFICACAO_MANCHESTER"]:checked').value,
                    principaisQueixas: document.getElementById("PRINCIPAIS_QUEIXAS").value
                })
            });

            const dados = await resposta.json();

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


// H07 - Carrega as filas da triagem

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

            const dados = await resposta.json();

            if (!resposta.ok) {
                mensagemFila.textContent =
                    dados.mensagem || "Erro ao carregar a fila de triagem.";
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

            if (dados.atendimentos.length === 0) {
                mensagemFila.textContent =
                    "Não há atendimentos aguardando triagem.";
            } else {
                mensagemFila.textContent = "";
            }

        } catch (erro) {

            console.error("Erro ao carregar fila de triagem:", erro);

            mensagemFila.textContent =
                "Erro ao conectar com o servidor.";

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

            const dados = await resposta.json();

            if (!resposta.ok) {
                mensagemAguardando.textContent =
                    dados.mensagem || "Erro ao carregar os atendimentos.";
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

                linha.querySelector(".fila-reclassificar").href =
                    "reclassificar.html?numero=" +
                    encodeURIComponent(atendimento.numero);

                listaAguardando.appendChild(linha);

            });

            if (dados.atendimentos.length === 0) {
                mensagemAguardando.textContent =
                    "Não há atendimentos aguardando médico.";
            } else {
                mensagemAguardando.textContent = "";
            }

        } catch (erro) {

            console.error("Erro ao carregar atendimentos:", erro);

            mensagemAguardando.textContent =
                "Erro ao conectar com o servidor.";

        }

    }

    carregarFilaTriagem();
    carregarFilaAguardando();


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

        const dados = await resposta.json();

        if (!resposta.ok) {
            alert(dados.mensagem || "Não foi possível carregar o atendimento.");
            return;
        }

        const atendimento = dados.atendimento;

        document.getElementById("ID_ATENDIMENTO").value =
            atendimento.id;

        document.getElementById("PRESSAO_ARTERIAL").value =
            atendimento.pressaoArterial || "";

        document.getElementById("TEMPERATURA").value =
            atendimento.temperatura || "";

        document.getElementById("BATIMENTOS_CARDIACOS").value =
            atendimento.batimentosCardiacos || "";

        document.querySelector('input[name="CLASSIFICACAO_MANCHESTER"]:checked').value =
            atendimento.classificacao || "";

        document.getElementById("PRINCIPAIS_QUEIXAS").value =
            atendimento.principaisQueixas || "";

    } catch (erro) {

        console.error("Erro ao carregar dados da triagem:", erro);

        alert("Erro ao conectar com o servidor.");

    }

}

carregarDadosTriagem();



// H12.3 - Painel do médico
// Lista atendimentos aguardando médico

const listaMedico = document.getElementById("listaMedico");
const modeloMedico = document.getElementById("modeloMedico");
const mensagemPainel = document.getElementById("mensagemPainel");

async function carregarPainelMedico() {

    if (!listaMedico || !modeloMedico) {
        return;
    }

    try {

        const resposta = await fetch(
            "/api/atendimentos/aguardando-medico"
        );

        const dados = await resposta.json();

        if (!resposta.ok) {

            mensagemPainel.textContent =
                dados.mensagem || "Não foi possível carregar os atendimentos.";

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

            // Coloca o número do atendimento no botão Acessar
            linha.querySelector(".fila-acessar").href =
                "atendimento-medico.html?numero=" +
                encodeURIComponent(atendimento.numero);

            // Quando o médico clicar em Acessar
            linha.querySelector(".fila-acessar").addEventListener(
                "click",
                async function (evento) {

                    evento.preventDefault();

                    const numero = atendimento.numero;

                    try {

                        const respostaAtender = await fetch(
                            "/api/medico/atender/" +
                            encodeURIComponent(numero),
                            {
                                method: "POST"
                            }
                        );

                        const dadosAtender =
                            await respostaAtender.json();

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

                        alert(
                            "Erro ao conectar com o servidor."
                        );

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

        mensagemPainel.textContent =
            "Erro ao conectar com o servidor.";

    }

}

carregarPainelMedico();

// H06 - Consulta e cancelamento de atendimentos

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
    CONFIRMADO: "Confirmado",
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
            "Informe um número de atendimento válido ou um CPF com 11 dígitos.";

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

        const dados = await resposta.json();

        if (!resposta.ok) {

            mensagemConsulta.textContent =
                dados.mensagem || "Não foi possível consultar o atendimento.";

            return;
        }

        listaAtendimentos.innerHTML = "";

        dados.atendimentos.forEach(function (atendimento) {

            const ficha = modeloAtendimento.content.cloneNode(true);

            const artigo = ficha.querySelector(".ficha-atendimento");

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


            // Se já estiver cancelado, exibe o motivo registrado
            if (atendimento.status === "CANCELADO") {

                motivo.hidden = false;

                textoMotivo.textContent =
                    atendimento.motivoCancelamento || "Não informado";

                botaoCancelar.hidden = true;
                linkAlterar.hidden = true;

            } else {

                motivo.hidden = true;

                // Não permite cancelar depois que o médico assumiu
                if (
                    atendimento.status === "EM_ATENDIMENTO" ||
                    atendimento.status === "CONFIRMADO"
                ) {

                    botaoCancelar.hidden = true;
                    mensagemRecusa.textContent =
                        "Não é possível cancelar: o médico já assumiu ou finalizou este atendimento.";

                }

                // Só permite alterar atendimentos não finalizados
                if (atendimento.status === "CONFIRMADO") {
                    linkAlterar.hidden = true;
                }

            }


            // Abre o formulário de cancelamento
            botaoCancelar.addEventListener("click", function () {

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
                            await respostaCancelamento.json();

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
