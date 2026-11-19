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
                const item = document.createElement('div');
                item.append(linha, formularioTriagem(atendimento.numero, atualizarFila));
                fila.append(item);
            });
        } catch (erro) { mensagem.textContent = erro.message; }
        finally { carregando = false; }
    }
    document.getElementById('atualizarFila').addEventListener('click', atualizarFila);
    atualizarFila();
    setInterval(() => {
        if (!fila.contains(document.activeElement)) atualizarFila();
    }, 15000);
}

const coresTriagem = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL'];

function formularioTriagem(numero, atualizar) {
    const form = document.createElement('form');
    const rotulo = document.createElement('label');
    const cor = document.createElement('select');
    const botao = document.createElement('button');
    const mensagem = document.createElement('span');
    rotulo.textContent = 'Classificação de ' + numero + ' ';
    cor.append(...coresTriagem.map(valor => new Option(valor, valor)));
    cor.prepend(new Option('Selecione a cor', '', true, true));
    cor.required = true;
    botao.className = 'botao';
    botao.textContent = 'Registrar triagem';
    mensagem.setAttribute('role', 'status');
    rotulo.append(cor);
    form.append(rotulo, botao, mensagem);
    form.addEventListener('submit', async evento => {
        evento.preventDefault();
        botao.disabled = true;
        try {
            await enviarJSON('/api/triagem/' + numero, 'POST', { cor: cor.value });
            await atualizar();
        } catch (erro) {
            mensagem.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });
    return form;
}

function enviarJSON(url, method, dados) {
    return api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
}

const consultaAtendimentos = document.getElementById('consultaAtendimentos');
if (consultaAtendimentos) {
    const entrada = document.getElementById('buscaAtendimento');
    const mensagem = document.getElementById('mensagemConsultaAtendimentos');
    const lista = document.getElementById('resultadosAtendimentos');
    const editor = document.getElementById('editorAtendimento');
    const controleStatus = editor.elements.status;
    const motivo = editor.elements.motivoCancelamento;
    let atendimentoAtual;

    function mostrarResultados(atendimentos) {
        lista.replaceChildren();
        for (const atendimento of atendimentos) {
            const item = document.createElement('li');
            const dados = [
                atendimento.numero, atendimento.nome, atendimento.cpf, atendimento.status,
                'Observações: ' + (atendimento.observacoes || '—'),
                'Orientações: ' + (atendimento.orientacoes || '—')
            ];
            if (atendimento.dataHoraAlta) dados.push('Alta: ' + new Date(atendimento.dataHoraAlta).toLocaleString('pt-BR'));
            if (atendimento.dataHoraCancelamento) dados.push('Cancelamento: ' + new Date(atendimento.dataHoraCancelamento).toLocaleString('pt-BR'));
            if (atendimento.motivoCancelamento) dados.push('Motivo: ' + atendimento.motivoCancelamento);
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'botao botao-secundario';
            botao.textContent = 'Editar ' + atendimento.numero;
            botao.addEventListener('click', () => {
                atendimentoAtual = atendimento;
                editor.querySelector('legend').textContent = 'Editar ' + atendimento.numero;
                editor.elements.cpfPaciente.value = atendimento.cpf;
                editor.elements.observacoes.value = atendimento.observacoes || '';
                editor.elements.orientacoes.value = atendimento.orientacoes || '';
                motivo.value = atendimento.motivoCancelamento || '';
                controleStatus.value = atendimento.status;
                controleStatus.disabled = atendimento.status !== 'ABERTO';
                controleStatus.dispatchEvent(new Event('change'));
                editor.hidden = false;
                editor.elements.cpfPaciente.focus();
            });
            item.append(dados.join(' | '), document.createElement('br'), botao);
            lista.append(item);
        }
    }

    controleStatus.addEventListener('change', () => {
        const cancelado = controleStatus.value === 'CANCELADO';
        motivo.closest('label').hidden = !cancelado;
        motivo.required = cancelado && (!controleStatus.disabled || Boolean(atendimentoAtual?.motivoCancelamento));
    });

    consultaAtendimentos.addEventListener('submit', async evento => {
        evento.preventDefault();
        editor.hidden = true;
        lista.replaceChildren();
        mensagem.textContent = 'Buscando...';
        try {
            const { atendimentos } = await api('/api/atendimentos/' + encodeURIComponent(entrada.value.trim()));
            mostrarResultados(atendimentos);
            mensagem.textContent = '';
        } catch (erro) {
            mensagem.textContent = erro.message;
        }
    });

    editor.addEventListener('submit', async evento => {
        evento.preventDefault();
        const atendimento = atendimentoAtual;
        const botao = evento.submitter;
        botao.disabled = true;
        try {
            const cpf = editor.elements.cpfPaciente.value.replace(/\D/g, '');
            const dados = {};
            if (!/^\d{11}$/.test(cpf)) throw new Error('Informe um CPF com 11 dígitos.');
            if (cpf !== atendimento.cpf) {
                const { paciente } = await api('/api/pacientes/' + cpf);
                dados.idPaciente = paciente.id;
            }
            for (const campo of ['status', 'observacoes', 'orientacoes', 'motivoCancelamento']) {
                const valor = editor.elements[campo].value.trim() || null;
                if ((campo !== 'motivoCancelamento' || controleStatus.value === 'CANCELADO') &&
                    valor !== (atendimento[campo] ?? null)) dados[campo] = valor;
            }
            const { atendimentos } = await enviarJSON('/api/atendimentos/' + atendimento.numero, 'PUT', dados);
            entrada.value = atendimento.numero;
            mostrarResultados(atendimentos);
            editor.hidden = true;
            mensagem.textContent = 'Atendimento salvo.';
        } catch (erro) {
            mensagem.textContent = erro.status === 404 && erro.message === 'não encontrado'
                ? 'CPF do paciente não cadastrado.' : erro.message;
        } finally {
            botao.disabled = false;
        }
    });
}

const filaMedica = document.getElementById('filaMedica');
if (filaMedica) {
    const mensagem = document.getElementById('mensagemFilaMedica');
    let carregando = false;
    async function atualizarFilaMedica() {
        if (carregando) return;
        carregando = true;
        try {
            const { atendimentos } = await api('/api/medico/fila');
            filaMedica.replaceChildren();
            for (const atendimento of atendimentos) {
                const item = document.createElement('li');
                const botao = document.createElement('button');
                botao.className = 'botao';
                botao.textContent = 'Confirmar e registrar alta';
                botao.addEventListener('click', async () => {
                    botao.disabled = true;
                    try {
                        await enviarJSON('/api/atendimentos/' + atendimento.numero, 'PUT', { status: 'CONFIRMADO' });
                        await atualizarFilaMedica();
                    } catch (erro) {
                        mensagem.textContent = erro.message;
                        botao.disabled = false;
                    }
                });
                item.append(atendimento.cor + ' | ' + atendimento.numero + ' | ' + atendimento.nome + ' | ' +
                    new Date(atendimento.dataHoraTriagem).toLocaleString('pt-BR'), document.createElement('br'), botao);
                filaMedica.append(item);
            }
            mensagem.textContent = atendimentos.length ? '' : 'Nenhum atendimento aguardando o médico.';
        } catch (erro) {
            mensagem.textContent = erro.message;
        } finally {
            carregando = false;
        }
    }
    document.getElementById('atualizarFilaMedica').addEventListener('click', atualizarFilaMedica);
    atualizarFilaMedica();
    setInterval(atualizarFilaMedica, 15000);
}
