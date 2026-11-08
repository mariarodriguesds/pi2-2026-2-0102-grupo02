const { test } = require('node:test');
const assert = require('node:assert/strict');

test('H08.1 / H09.1: FK, relação 1:1 e cinco cores no MySQL real', { skip: process.env.TESTAR_BANCO !== '1' }, async () => {
    const mysql = require('mysql2/promise');
    const config = require('../javascript/config');
    const banco = await mysql.createConnection(config.banco);
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
