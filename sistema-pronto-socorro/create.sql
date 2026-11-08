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

CREATE INDEX idx_atendimento_paciente ON atendimento (id_paciente);
-- H08.1 / H09.1
CREATE TABLE triagem (
 id_triagem INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 id_atendimento INT NOT NULL,
 pressao_arterial VARCHAR(15) NULL,
 temperatura DECIMAL(4,1) NULL,
 batimentos_cardiacos SMALLINT NULL,
 classificacao_manchester VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 principais_queixas TEXT NULL,
 data_hora_triagem DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_triagem_atendimento (id_atendimento),
 CONSTRAINT ck_triagem_manchester CHECK (classificacao_manchester IN ('VERMELHO','LARANJA','AMARELO','VERDE','AZUL')),
 CONSTRAINT fk_triagem_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento(id_atendimento)
 ON DELETE RESTRICT ON UPDATE CASCADE,
 INDEX idx_triagem_classificacao (classificacao_manchester)
) ENGINE=InnoDB;
