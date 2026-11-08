# Modelo lógico — H08.1 e H09.1

`paciente` (1) → (N) `atendimento` (1) → (0..1) `triagem`.

A chave primária de triagem é id_triagem. id_atendimento é uma chave estrangeira obrigatória e única: uma triagem pertence a exatamente um atendimento, e um atendimento pode aguardar triagem. A exclusão de atendimento com triagem é restringida. A reclassificação altera a classificação do mesmo registro.

| Atributo de triagem | Tipo | Regra |
| --- | --- | --- |
| id_triagem | INT | PK, autoincremento |
| id_atendimento | INT | FK, obrigatório, único |
| pressao_arterial | VARCHAR(15) | Opcional |
| temperatura | DECIMAL(4,1) | Opcional |
| batimentos_cardiacos | SMALLINT | Opcional |
| classificacao_manchester | VARCHAR(8) | Obrigatório, CHECK: VERMELHO, LARANJA, AMARELO, VERDE, AZUL |
| principais_queixas | TEXT | Opcional |
| data_hora_triagem | DATETIME | Obrigatório, data/hora atual por padrão |

As cinco cores são armazenadas em maiúsculas; a collation ascii_bin impede variações de caixa. O CHECK exige MySQL 8.0.16+ ou MariaDB 10.2.1+. O índice de classificação permite futuras consultas por prioridade.

Para bases novas, execute sistema-pronto-socorro/create.sql. Para bases existentes no modelo anterior, execute migrations/001_triagem.sql uma vez. A migração copia as triagens classificadas e preserva os campos legados de atendimento para conferência. Se houver cores inválidas, a cópia falha: corrija os dados e repita somente o INSERT (o DDL MySQL não é transacional). Registros sem classificação permanecem pendentes; os sinais legados são preservados no atendimento.

# Integrações

- H03.3: POST /api/pacientes persiste o cadastro; a tela redireciona para a recepção e consulta o CPF salvo.
- H04.3: PUT /api/pacientes/:id altera os dados; a tela consulta o CPF atualizado após salvar, inclusive quando o CPF mudou.
- H07.3: GET /api/triagem/pendentes lista atendimentos ABERTO sem triagem, com nome e CPF atuais, em ordem de chegada e id. A tela atualiza ao abrir, por botão e a cada 15 segundos.

Os códigos de cadastro/edição reaproveitam as implementações anteriores às exclusões a28fa99 e 4e0cd39, adaptadas ao servidor principal e às rotas plurais existentes. As telas mantêm a estrutura HTML/CSS dos commits 13eee9a e f7d6602. As tarefas H08.1/H09.1 são de banco: não adicionam um formulário de registro clínico.
