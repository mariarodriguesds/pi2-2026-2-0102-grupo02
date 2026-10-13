
const form = document.getElementById('formConsulta');
const resultado = document.getElementById('resultado');

form.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    const cpf = document.getElementById('cpf').value.trim();

    try {
        const resposta = await fetch(
            '/api/pacientes/' + encodeURIComponent(cpf)
        );

        const dados = await resposta.json();

        if (resposta.status === 404) {
            window.location.href = dados.redirecionarPara;
            return;
        }

        if (!resposta.ok) {
            resultado.textContent = dados.mensagem;
            return;
        }

        resultado.textContent =
            'Paciente encontrado! Nome: ' + dados.paciente.nome +
            ' | CPF: ' + dados.paciente.cpf +
            ' | Data de nascimento: ' +
            (dados.paciente.dataNascimento
                ? dados.paciente.dataNascimento.substring(0, 10)
                : 'Não informada');

    } catch (erro) {
        resultado.textContent =
            'Erro ao conectar com o servidor.';
    }
});
