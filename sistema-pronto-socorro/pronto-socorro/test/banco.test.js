const { test } = require('node:test');
const assert = require('node:assert/strict');

test('H08.1 / H09.1: FK, relação 1:1 e cinco cores no MySQL real', { skip: process.env.TESTAR_BANCO !== '1' }, async () => {
    const mysql = require('mysql2/promise');
    const banco = await mysql.createConnection(process.env.URL_BANCO_TESTE || require('../javascript/config').banco);
    try {
        await banco.beginTransaction();
        const cpf = String(Date.now()).slice(-11);
        const [paciente] = await banco.execute('INSERT INTO paciente (nome_completo, cpf) VALUES (?, ?)', ['Teste rollback', cpf]);
        const [atendimento] = await banco.execute('INSERT INTO atendimento (numero_atendimento, id_paciente) VALUES (?, ?)', ['TEST' + Date.now(), paciente.insertId]);
        await banco.execute('INSERT INTO triagem (id_atendimento, classificacao_manchester) VALUES (?, ?)', [atendimento.insertId, 'VERMELHO']);
        for (const cor of ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL']) {
            await banco.execute('UPDATE triagem SET classificacao_manchester = ? WHERE id_atendimento = ?', [cor, atendimento.insertId]);
            const [[registro]] = await banco.execute('SELECT classificacao_manchester AS cor FROM triagem WHERE id_atendimento = ?', [atendimento.insertId]);
            assert.equal(registro.cor, cor);
        }
        for (const cor of ['ROXO', '', 'vermelho', null]) {
            await assert.rejects(banco.execute('UPDATE triagem SET classificacao_manchester = ? WHERE id_atendimento = ?', [cor, atendimento.insertId]));
        }
        await assert.rejects(banco.execute('INSERT INTO triagem (id_atendimento, classificacao_manchester) VALUES (?, ?)', [atendimento.insertId, 'AZUL']), { code: 'ER_DUP_ENTRY' });
        await assert.rejects(banco.execute('INSERT INTO triagem (id_atendimento, classificacao_manchester) VALUES (?, ?)', [-1, 'AZUL']), { code: 'ER_NO_REFERENCED_ROW_2' });
    } finally {
        await banco.rollback();
        await banco.end();
    }
});

test('H10.3, H11.3, H13.1, H14.1 e H15.1 via HTTP e MySQL', { skip: process.env.TESTAR_BANCO !== '1' }, async t => {
    const mysql = require('mysql2/promise');
    const { criarServidor } = require('../javascript/servidor');
    const banco = await mysql.createConnection(process.env.URL_BANCO_TESTE || require('../javascript/config').banco);
    const servidor = criarServidor(banco);
    await banco.beginTransaction();
    t.after(async () => {
        try {
            await new Promise(resolve => servidor.close(resolve));
            await banco.rollback();
        } finally {
            await banco.end();
        }
    });
    await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + servidor.address().port;
    async function chamar(caminho, method = 'GET', dados) {
        const resposta = await fetch(base + caminho, {
            method, headers: { 'Content-Type': 'application/json' },
            body: dados === undefined ? undefined : JSON.stringify(dados)
        });
        return { status: resposta.status, dados: await resposta.json() };
    }

    const sufixo = String(Date.now()).slice(-10);
    const cpf = '1' + sufixo;
    const outroCpf = '2' + sufixo;
    const [paciente] = await banco.execute('INSERT INTO paciente (nome_completo, cpf) VALUES (?, ?)', ['Fila Teste', cpf]);
    const [outroPaciente] = await banco.execute('INSERT INTO paciente (nome_completo, cpf) VALUES (?, ?)', ['Consulta Teste', outroCpf]);
    const numeros = ['1', '2', '3'].map(final => 'AT9' + sufixo + final);
    for (const numero of numeros) {
        await banco.execute('INSERT INTO atendimento (numero_atendimento, id_paciente) VALUES (?, ?)', [numero, paciente.insertId]);
    }
    const [maisAntigo, maisRecente, vermelho] = numeros;
    const atendimento = numero => '/api/atendimentos/' + numero;
    const classificar = (numero, cor) => chamar('/api/triagem/' + numero, 'POST', { cor });
    const fila = async () => {
        const resposta = await chamar('/api/medico/fila');
        assert.equal(resposta.status, 200);
        return resposta.dados.atendimentos.map(item => item.numero).filter(numero => numeros.includes(numero));
    };

    // Insere em ordem inversa para que só o horário de triagem determine o desempate.
    assert.equal((await classificar(maisRecente, 'AMARELO')).status, 201);
    assert.equal((await classificar(maisAntigo, 'AMARELO')).status, 201);
    await banco.execute(`UPDATE triagem t JOIN atendimento a ON a.id_atendimento = t.id_atendimento
        SET t.data_hora_triagem = CURRENT_TIMESTAMP - INTERVAL 1 MINUTE WHERE a.numero_atendimento = ?`, [maisAntigo]);
    assert.deepEqual(await fila(), [maisAntigo, maisRecente]);
    assert.equal((await classificar(vermelho, 'VERMELHO')).status, 201);
    assert.deepEqual(await fila(), [vermelho, maisAntigo, maisRecente]);

    assert.equal((await chamar(atendimento(maisRecente), 'PUT', { dataHoraChegada: '2026-01-01' })).status, 400);
    assert.equal((await chamar(atendimento(maisRecente), 'PUT', {
        idPaciente: outroPaciente.insertId, observacoes: 'Observação alterada', orientacoes: 'Orientação registrada'
    })).status, 200);
    const consulta = (await chamar(atendimento(outroCpf))).dados.atendimentos[0];
    assert.equal(consulta.numero, maisRecente);
    assert.equal(consulta.observacoes, 'Observação alterada');
    assert.equal(consulta.orientacoes, 'Orientação registrada');
    assert.equal((await chamar(atendimento(maisRecente))).dados.atendimentos[0].cpf, outroCpf);

    const alta = await chamar(atendimento(vermelho), 'PUT', { status: 'CONFIRMADO' });
    assert.equal(alta.status, 200);
    assert.ok(alta.dados.atendimentos[0].dataHoraAlta);
    const repeticao = await chamar(atendimento(vermelho), 'PUT', { status: 'CONFIRMADO' });
    assert.equal(repeticao.status, 200);
    assert.equal(repeticao.dados.atendimentos[0].dataHoraAlta, alta.dados.atendimentos[0].dataHoraAlta);
    assert.equal((await chamar(atendimento(maisAntigo), 'PUT', { status: 'CANCELADO' })).status, 400);
    const cancelamento = await chamar(atendimento(maisAntigo), 'PUT', { status: 'CANCELADO', motivoCancelamento: 'Desistência' });
    assert.equal(cancelamento.status, 200);
    assert.ok(cancelamento.dados.atendimentos[0].dataHoraCancelamento);
    assert.equal(cancelamento.dados.atendimentos[0].motivoCancelamento, 'Desistência');
    assert.equal(cancelamento.dados.atendimentos[0].dataHoraAlta, null);
    assert.equal((await chamar(atendimento(maisAntigo), 'PUT', { status: 'CONFIRMADO' })).status, 409);
    assert.deepEqual(await fila(), [maisRecente]);

    await banco.execute(`INSERT INTO medicacao (id_atendimento, nome)
        SELECT id_atendimento, ? FROM atendimento WHERE numero_atendimento = ?`, ['Medicação teste', vermelho]);
    await assert.rejects(banco.execute('INSERT INTO medicacao (id_atendimento, nome) VALUES (?, ?)', [-1, 'Sem atendimento']),
        { code: 'ER_NO_REFERENCED_ROW_2' });
    assert.equal((await fetch(base + '/medico.html')).status, 200);
});
