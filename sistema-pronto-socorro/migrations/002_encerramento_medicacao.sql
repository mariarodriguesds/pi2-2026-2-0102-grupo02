-- Execute uma vez em instalações existentes com 001_triagem.sql aplicado.
USE pronto_socorro;

ALTER TABLE atendimento
    ADD COLUMN orientacoes TEXT NULL,
    ADD COLUMN data_hora_cancelamento DATETIME NULL,
    ADD COLUMN motivo_cancelamento TEXT NULL;

CREATE TABLE medicacao (
    id_medicacao INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_atendimento INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    posologia VARCHAR(255) NULL,
    CONSTRAINT fk_medicacao_atendimento FOREIGN KEY (id_atendimento)
        REFERENCES atendimento (id_atendimento) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_medicacao_atendimento (id_atendimento)
) ENGINE=InnoDB;
