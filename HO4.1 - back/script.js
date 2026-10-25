
var formBuscar = document.getElementById("formBuscarPaciente");
var formEditar = document.getElementById("formEditarPaciente");

var campoCPFBusca = document.getElementById("cpfBusca");
var areaEdicao = document.getElementById("areaEdicao");

var mensagemBusca = document.getElementById("mensagemBusca");
var mensagemEdicao = document.getElementById("mensagemEdicao");

var botaoSalvar = document.getElementById("botaoSalvar");
var botaoCancelar = document.getElementById("botaoCancelar");

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
formBuscar.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    limparEdicao();
    mostrarMensagem(mensagemBusca, "");

    var cpf = limparCPF(campoCPFBusca.value);

    if (!/^\d{11}$/.test(cpf)) {
        mostrarMensagem(
            mensagemBusca,
            "Informe um CPF com 11 dígitos."
        );
        return;
    }

    mostrarMensagem(mensagemBusca, "Buscando paciente...");

    try {
        var resposta = await fetch(
            "/api/paciente/" + cpf
        );

        var dados = await lerResposta(resposta);

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

// Salvar alterações do paciente
formEditar.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    mostrarMensagem(mensagemEdicao, "");

    var id = document.getElementById("id_paciente").value;
    var cpf = limparCPF(
        document.getElementById("cpf").value
    );

    var nome = document.getElementById("nome_completo").value.trim();

    if (!id || !nome || nome.length > 150 ||
        !/^\d{11}$/.test(cpf)) {
        mostrarMensagem(
            mensagemEdicao,
            "Confira o nome e informe um CPF com 11 dígitos."
        );
        return;
    }

    var dadosPaciente = {
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
    mostrarMensagem(mensagemEdicao, "Salvando alterações...");

    try {
        var resposta = await fetch(
            "/api/paciente/" + encodeURIComponent(id),
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dadosPaciente)
            }
        );

        var dados = await lerResposta(resposta);

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

// Cancelar a edição
botaoCancelar.addEventListener("click", function () {
    limparEdicao();
    mostrarMensagem(mensagemBusca, "Edição cancelada.");
});
