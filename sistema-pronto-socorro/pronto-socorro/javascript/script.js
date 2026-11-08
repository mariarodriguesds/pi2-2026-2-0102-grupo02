
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
