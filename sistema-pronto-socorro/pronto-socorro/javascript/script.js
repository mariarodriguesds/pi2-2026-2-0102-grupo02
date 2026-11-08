// Fluxos de recepção e triagem usam a mesma API e persistência.
async function api(url, opcoes) {
    const resposta = await fetch(url, opcoes);
    const dados = await resposta.json();
    if (!resposta.ok) {
        const erro = new Error(dados.mensagem || 'Erro na operação.');
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}
const camposPaciente = ['nome_completo', 'cpf', 'rg', 'data_nascimento', 'telefone', 'nome_mae', 'nome_pai', 'endereco'];
const formConsulta = document.getElementById('formConsulta');
let pacienteAtual = null;
if (formConsulta) {
    const cpfInicial = new URLSearchParams(location.search).get('cpf');
    if (cpfInicial) document.getElementById('cpf').value = cpfInicial;
    formConsulta.addEventListener('submit', async evento => {
        evento.preventDefault();
        pacienteAtual = null;
        document.getElementById('areaAtendimento').hidden = true;
        document.getElementById('atendimentoAberto').hidden = true;
        document.getElementById('mensagemAtendimento').textContent = '';
        const resultado = document.getElementById('resultado');
        resultado.textContent = 'Buscando...';
        const cpf = document.getElementById('cpf').value;
        try {
            const dados = await api('/api/pacientes/' + encodeURIComponent(cpf));
            pacienteAtual = dados.paciente;
            resultado.textContent = 'Paciente: ' + pacienteAtual.nome + ' | CPF: ' + pacienteAtual.cpf +
                ' | Nascimento: ' + (pacienteAtual.dataNascimento || 'Não informado');
            const editar = document.createElement('a');
            editar.className = 'botao botao-secundario';
            editar.href = '/editar-paciente.html?cpf=' + encodeURIComponent(pacienteAtual.cpf);
            editar.textContent = 'Editar dados pessoais';
            resultado.append(document.createElement('br'), editar);
            document.getElementById('areaAtendimento').hidden = false;
        } catch (erro) {
            if (erro.status === 404) {
                location.href = '/paciente-nao-encontrado.html?cpf=' + encodeURIComponent(cpf);
            } else resultado.textContent = erro.message;
        }
    });
    document.getElementById('botaoAbrirAtendimento').addEventListener('click', async evento => {
        if (!pacienteAtual) return;
        const botao = evento.currentTarget;
        botao.disabled = true;
        document.getElementById('mensagemAtendimento').textContent = '';
        try {
            const dados = await api('/api/atendimentos', { method: 'POST',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idPaciente: pacienteAtual.id }) });
            document.getElementById('numeroAtendimento').textContent = dados.numero;
            document.getElementById('atendimentoAberto').hidden = false;
        } catch (erro) {
            document.getElementById('mensagemAtendimento').textContent = erro.message;
        } finally { botao.disabled = false; }
    });
    if (cpfInicial) formConsulta.requestSubmit();
}
const formPaciente = document.getElementById('formCadastroPaciente') || document.getElementById('formEditarPaciente');
if (formPaciente) {
    const editando = formPaciente.id === 'formEditarPaciente';
    const mensagem = document.getElementById('mensagem');
    const botao = formPaciente.querySelector('button[type="submit"]');
    let id = null;
    const cpf = new URLSearchParams(location.search).get('cpf') || '';
    document.getElementById('cpf').value = cpf;
    if (editando) {
        botao.disabled = true;
        api('/api/pacientes/' + encodeURIComponent(cpf)).then(({ paciente }) => {
            id = paciente.id;
            const valores = { ...paciente, nome_completo: paciente.nome, data_nascimento: paciente.dataNascimento };
            camposPaciente.forEach(campo => { document.getElementById(campo).value = valores[campo] || ''; });
            botao.disabled = false;
        }).catch(erro => { mensagem.textContent = erro.message; });
    }
    formPaciente.addEventListener('submit', async evento => {
        evento.preventDefault();
        botao.disabled = true;
        const dados = Object.fromEntries(camposPaciente.map(campo => [campo, document.getElementById(campo).value]));
        try {
            await api('/api/pacientes' + (editando ? '/' + id : ''), {
                method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
            });
            location.href = '/recepcao.html?cpf=' + encodeURIComponent(dados.cpf);
        } catch (erro) {
            mensagem.textContent = erro.message;
        } finally { botao.disabled = false; }
    });
}
const fila = document.getElementById('filaTriagem');
if (fila) {
    let carregando = false;
    async function atualizarFila() {
        if (carregando) return;
        carregando = true;
        const mensagem = document.getElementById('mensagemFila');
        try {
            const { atendimentos } = await api('/api/triagem/pendentes');
            fila.replaceChildren();
            mensagem.textContent = atendimentos.length ? atendimentos.length + ' atendimento(s) aguardando.' : 'Nenhum atendimento aguardando triagem.';
            atendimentos.forEach(atendimento => {
                const linha = document.createElement('p');
                linha.textContent = atendimento.numero + ' | ' + atendimento.nome + ' | CPF: ' + atendimento.cpf +
                    ' | Chegada: ' + new Date(atendimento.dataHoraChegada).toLocaleString('pt-BR');
                fila.append(linha);
            });
        } catch (erro) { mensagem.textContent = erro.message; }
        finally { carregando = false; }
    }
    document.getElementById('atualizarFila').addEventListener('click', atualizarFila);
    atualizarFila();
    setInterval(atualizarFila, 15000);
}
