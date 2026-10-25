
/* ================================
   CONSULTA DE PACIENTES
================================ */

const form = document.getElementById("formConsulta");
const resultado = document.getElementById("resultado");

if (form) {
    form.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const cpf = document.getElementById("cpf").value;
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

            resultado.textContent =
                "Paciente encontrado. " +
                "Nome: " + dados.paciente.nome_completo +
                " | CPF: " + dados.paciente.cpf +
                " | Data de nascimento: " +
                (dados.paciente.data_nascimento || "Não informada");

        } catch (erro) {
            resultado.textContent = "Erro ao conectar com o servidor.";
            console.error("Erro na consulta:", erro);
        }
    });
}


/* ================================
   CADASTRO DE PACIENTES
================================ */

const formulario = document.getElementById("formCadastroPaciente");
const mensagem = document.getElementById("mensagem");

if (formulario) {
    formulario.addEventListener("submit", async function (evento) {
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

        mensagem.textContent = "";

        if (!nome || !cpfLimpo) {
            mensagem.textContent =
                "Preencha o nome completo e o CPF.";
            return;
        }

        if (!/^\d{11}$/.test(cpfLimpo)) {
            mensagem.textContent =
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
                mensagem.textContent =
                    "Informe uma data de nascimento válida.";
                return;
            }
        }

        if (telefoneLimpo && !/^\d{10,11}$/.test(telefoneLimpo)) {
            mensagem.textContent =
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
            mensagem.textContent = "Cadastrando paciente...";

            const resposta = await fetch("/api/paciente", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(paciente)
            });

            const dados = await resposta.json();

            if (resposta.status === 409) {
                mensagem.textContent = "CPF já cadastrado.";
                return;
            }

            if (!resposta.ok) {
                mensagem.textContent =
                    dados.mensagem || "Não foi possível cadastrar o paciente.";
                return;
            }

            mensagem.textContent = "Paciente cadastrado com sucesso!";
            formulario.reset();

        } catch (erro) {
            mensagem.textContent = "Erro ao conectar com o servidor.";
            console.error("Erro no cadastro:", erro);
        }
    });
}
