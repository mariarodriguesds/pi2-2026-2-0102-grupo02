-- =====================================================
-- Pronto Socorro - esquema completo e dados fictícios
-- Pode ser executado mais de uma vez sem dar erro
-- Compatível com MySQL 8.0.16+ / MariaDB 10.2.1+
-- =====================================================

CREATE DATABASE IF NOT EXISTS pronto_socorro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pronto_socorro;

-- -----------------------------------------------------
-- Tabela: paciente
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente         INT             NOT NULL AUTO_INCREMENT,
    nome_completo       VARCHAR(150)    NOT NULL,
    cpf                 CHAR(11)        NOT NULL,
    rg                  VARCHAR(20)     NULL,
    data_nascimento     DATE            NULL,
    nome_pai            VARCHAR(150)    NULL,
    nome_mae            VARCHAR(150)    NULL,
    endereco            VARCHAR(255)    NULL,
    telefone            VARCHAR(20)     NULL,
    data_cadastro       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_paciente),
    UNIQUE KEY uk_paciente_cpf (cpf)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabela: atendimento
-- (orientacoes e cancelamento já ficam aqui, sem ALTER TABLE)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS atendimento (
    id_atendimento              INT             NOT NULL AUTO_INCREMENT,
    numero_atendimento          VARCHAR(20)     NOT NULL,          -- Ex: AT0001
    id_paciente                 INT             NOT NULL,
    data_hora_chegada           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                      ENUM('ABERTO','AGUARDANDO_TRIAGEM', 'EM_ATENDIMENTO', 'AGUARDANDO_MEDICO','CONFIRMADO','CANCELADO') NOT NULL DEFAULT 'ABERTO',

    -- Confirmação do Médico
    data_hora_confirmacao       DATETIME        NULL,
    observacoes                 TEXT            NULL,
    orientacoes                 TEXT            NULL,

    -- Cancelamento pela Recepção
    data_hora_cancelamento      DATETIME        NULL,
    motivo_cancelamento         TEXT            NULL,

    PRIMARY KEY (id_atendimento),
    UNIQUE KEY uk_numero_atendimento (numero_atendimento),

    -- Índices úteis para as telas
    INDEX idx_atendimento_status (status),
    INDEX idx_atendimento_paciente (id_paciente),

    CONSTRAINT fk_atendimento_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente (id_paciente)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabela: triagem (H08.1 / H09.1)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS triagem (
    id_triagem                  INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_atendimento              INT             NOT NULL,
    pressao_arterial            VARCHAR(15)     NULL,
    temperatura                 DECIMAL(4,1)    NULL,
    batimentos_cardiacos        SMALLINT        NULL,
    classificacao_manchester    VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    principais_queixas          TEXT            NULL,
    data_hora_triagem           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_triagem_atendimento (id_atendimento),
    INDEX idx_triagem_classificacao (classificacao_manchester),

    CONSTRAINT ck_triagem_manchester
        CHECK (classificacao_manchester IN ('VERMELHO','LARANJA','AMARELO','VERDE','AZUL')),

    CONSTRAINT fk_triagem_atendimento
        FOREIGN KEY (id_atendimento)
        REFERENCES atendimento (id_atendimento)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabela: medicacao
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS medicacao (
    id_medicacao                INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_atendimento              INT             NOT NULL,
    nome                        VARCHAR(150)    NOT NULL,
    posologia                   VARCHAR(255)    NULL,

    INDEX idx_medicacao_atendimento (id_atendimento),

    CONSTRAINT fk_medicacao_atendimento
        FOREIGN KEY (id_atendimento)
        REFERENCES atendimento (id_atendimento)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Dados fictícios de exemplo
-- INSERT IGNORE / NOT EXISTS: rodar de novo não duplica nada
-- -----------------------------------------------------
START TRANSACTION;

INSERT IGNORE INTO paciente (nome_completo, cpf) VALUES
    ('Paciente Exemplo Um', '00000000001'),
    ('Paciente Exemplo Dois', '00000000002'),
    ('Paciente Exemplo Três', '00000000003');

-- AT0001 e AT0002 já triados, aguardando o médico
INSERT IGNORE INTO atendimento (numero_atendimento, id_paciente, status, data_hora_chegada)
SELECT 'AT0001', id_paciente, 'AGUARDANDO_MEDICO', CURRENT_TIMESTAMP - INTERVAL 30 MINUTE FROM paciente WHERE cpf = '00000000001'
UNION ALL
SELECT 'AT0002', id_paciente, 'AGUARDANDO_MEDICO', CURRENT_TIMESTAMP - INTERVAL 20 MINUTE FROM paciente WHERE cpf = '00000000002'
UNION ALL
-- AT0003 aguardando triagem
SELECT 'AT0003', id_paciente, 'AGUARDANDO_TRIAGEM', CURRENT_TIMESTAMP - INTERVAL 10 MINUTE FROM paciente WHERE cpf = '00000000003';

INSERT IGNORE INTO triagem (id_atendimento, classificacao_manchester, data_hora_triagem)
SELECT id_atendimento, 'AMARELO', data_hora_chegada + INTERVAL 5 MINUTE
FROM atendimento WHERE numero_atendimento IN ('AT0001', 'AT0002');

-- AT0004 já confirmado pelo médico, com uma medicação
INSERT IGNORE INTO atendimento (numero_atendimento, id_paciente, status, data_hora_confirmacao, orientacoes)
SELECT 'AT0004', id_paciente, 'CONFIRMADO', CURRENT_TIMESTAMP, 'Orientação fictícia de exemplo.'
FROM paciente WHERE cpf = '00000000001';

INSERT INTO medicacao (id_atendimento, nome)
SELECT a.id_atendimento, 'Medicação fictícia de exemplo'
FROM atendimento a
WHERE a.numero_atendimento = 'AT0004'
  AND NOT EXISTS (
      SELECT 1 FROM medicacao m WHERE m.id_atendimento = a.id_atendimento
  );

COMMIT;
