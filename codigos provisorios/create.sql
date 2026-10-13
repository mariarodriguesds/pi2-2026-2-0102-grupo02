-- =====================================================
-- H01.2 - Script de criação das tabelas
-- Paciente e Atendimento (Pronto Socorro)
-- Compatível com MySQL 8.x / MariaDB
-- =====================================================

CREATE DATABASE IF NOT EXISTS pronto_socorro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pronto_socorro;

-- -----------------------------------------------------
-- Tabela: paciente
-- -----------------------------------------------------
CREATE TABLE paciente (
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
-- -----------------------------------------------------
CREATE TABLE atendimento (
    id_atendimento              INT             NOT NULL AUTO_INCREMENT,
    numero_atendimento          VARCHAR(20)    NOT NULL,          -- Ex: AT0001
    id_paciente                 INT             NOT NULL,
    data_hora_chegada           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                      ENUM('ABERTO','CONFIRMADO','CANCELADO') NOT NULL DEFAULT 'ABERTO',
    
    -- Dados da Triagem (Enfermagem)
    pressao_arterial            VARCHAR(15)     NULL,              -- Ex: 128/84
    temperatura                 DECIMAL(4,1)    NULL,              -- Ex: 37.4
    batimentos_cardiacos        SMALLINT        NULL,              -- bpm
    classificacao_manchester    VARCHAR(20)     NULL,              -- Vermelho, Laranja...
    principais_queixas          TEXT            NULL,
    data_hora_triagem           DATETIME        NULL,
    
    -- Confirmação do Médico
    data_hora_confirmacao       DATETIME        NULL,
    observacoes                 TEXT            NULL,
    
    PRIMARY KEY (id_atendimento),
    UNIQUE KEY uk_numero_atendimento (numero_atendimento),
    
    CONSTRAINT fk_atendimento_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente (id_paciente)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Índices úteis para as telas
CREATE INDEX idx_atendimento_status ON atendimento (status);
CREATE INDEX idx_atendimento_classificacao ON atendimento (classificacao_manchester);
CREATE INDEX idx_atendimento_paciente ON atendimento (id_paciente);