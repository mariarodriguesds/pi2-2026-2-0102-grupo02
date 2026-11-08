const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../javascript/servidor');

// Banco em memória na fronteira SQL: verifica HTTP e persistência entre requisições.
// A aplicação das constraints reais é verificada separadamente em test/banco.test.js.
function bancoMemoria() {
    const pacientes = [], atendimentos = [];
    const banco = { async execute(sql, args = []) {
        sql = sql.replace(/\s+/g, ' ').trim();
        if (sql.startsWith('INSERT INTO paciente')) {
            if (pacientes.some(p => p.cpf === args[1])) throw Object.assign(new Error(), { code: 'ER_DUP_ENTRY' });
            const [nome, cpf, rg, dataNascimento, nome_pai, nome_mae, endereco, telefone] = args;
            pacientes.push({ id: pacientes.length + 1, nome, cpf, rg, dataNascimento, nome_pai, nome_mae, endereco, telefone });
            return [{ insertId: pacientes.length }];
        }
        if (sql.startsWith('UPDATE paciente')) {
            const p = pacientes.find(p => p.id === args[8]);
            if (pacientes.some(outro => outro.cpf === args[1] && outro !== p)) throw Object.assign(new Error(), { code: 'ER_DUP_ENTRY' });
            const [nome, cpf, rg, dataNascimento, nome_pai, nome_mae, endereco, telefone] = args;
            Object.assign(p, { nome, cpf, rg, dataNascimento, nome_pai, nome_mae, endereco, telefone });
            return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('SELECT MAX')) return [[{ maior: atendimentos.length }]];
        if (sql.startsWith('INSERT INTO atendimento')) {
            atendimentos.push({ id: atendimentos.length + 1, numero: args[0], idPaciente: args[1], status: 'ABERTO', dataHoraChegada: new Date().toISOString() });
            return [{ insertId: atendimentos.length }];
        }
        if (sql.includes('LEFT JOIN triagem')) return [atendimentos.map(a => ({ ...a, ...pacientes.find(p => p.id === a.idPaciente), id: a.id }))];
        if (sql.includes('FROM paciente')) {
            let encontrados = sql.includes('id_paciente = ?') ? pacientes.filter(p => p.id === args[0]) : pacientes.filter(p => p.cpf === args[0]);
            if (sql.includes('id_paciente <> ?')) encontrados = encontrados.filter(p => p.id !== args[1]);
            return [encontrados];
        }
        throw new Error('SQL inesperado: ' + sql);
    }};
    return banco;
}

test('H03.3, H04.3 e H07.3: cadastro, edição, busca e fila via HTTP', async t => {
    const servidor = criarServidor(bancoMemoria());
    await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => servidor.close(resolve)));
    const base = 'http://127.0.0.1:' + servidor.address().port;
    async function requisicao(url, method = 'GET', dados) {
        const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: dados === undefined ? undefined : JSON.stringify(dados) });
        return { status: res.status, dados: await res.json() };
    }
    let dados = { nome_completo: 'Paciente Teste', cpf: '123.456.789-01', data_nascimento: '2000-01-02', endereco: 'Rua A' };
    assert.equal((await requisicao('/api/pacientes', 'POST', dados)).status, 201);
    let busca = await requisicao('/api/pacientes/12345678901');
    assert.equal(busca.dados.paciente.nome, 'Paciente Teste');
    assert.equal(busca.dados.paciente.endereco, 'Rua A');
    assert.equal((await requisicao('/api/pacientes', 'POST', dados)).status, 409);
    assert.equal((await requisicao('/api/pacientes', 'POST', { ...dados, cpf: '12' })).status, 400);
    assert.equal((await requisicao('/api/pacientes', 'POST', null)).status, 400);
    dados = { ...dados, nome_completo: 'Paciente Alterado', cpf: '98765432100', endereco: 'Rua B' };
    assert.equal((await requisicao('/api/pacientes/1', 'PUT', dados)).status, 200);
    assert.equal((await requisicao('/api/pacientes/12345678901')).status, 404);
    busca = await requisicao('/api/pacientes/987.654.321-00');
    assert.equal(busca.dados.paciente.nome, 'Paciente Alterado');
    assert.equal(busca.dados.paciente.endereco, 'Rua B');
    assert.equal((await requisicao('/api/pacientes/999', 'PUT', dados)).status, 404);
    assert.deepEqual((await requisicao('/api/triagem/pendentes')).dados.atendimentos, []);
    assert.equal((await requisicao('/api/atendimentos', 'POST', { idPaciente: 999 })).status, 404);
    assert.equal((await requisicao('/api/atendimentos', 'POST', { idPaciente: 1.5 })).status, 400);
    const aberto = await requisicao('/api/atendimentos', 'POST', { idPaciente: 1 });
    assert.equal(aberto.status, 201);
    const fila = (await requisicao('/api/triagem/pendentes')).dados.atendimentos;
    assert.equal(fila.length, 1);
    assert.equal(fila[0].numero, aberto.dados.numero);
    assert.equal(fila[0].nome, 'Paciente Alterado');
    for (const pagina of ['/cadastro-paciente.html', '/editar-paciente.html', '/triagem.html', '/script.js']) {
        const res = await fetch(base + pagina);
        assert.equal(res.status, 200, pagina);
    }
    assert.equal((await fetch(base + '/javascript/config.js')).status, 404);
    const malformado = await fetch(base + '/api/pacientes', { method: 'POST', body: '{' });
    assert.equal(malformado.status, 400);
});
