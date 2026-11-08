-- Executar uma vez em bases anteriores. MySQL >= 8.0.16 / MariaDB >= 10.2.1.
USE pronto_socorro;
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

-- Preserva campos antigos para conferência. Cores inválidas abortam a cópia pelo CHECK.
INSERT INTO triagem (id_atendimento, pressao_arterial, temperatura, batimentos_cardiacos,
 classificacao_manchester, principais_queixas, data_hora_triagem)
SELECT id_atendimento, pressao_arterial, temperatura, batimentos_cardiacos,
 UPPER(TRIM(classificacao_manchester)), principais_queixas, COALESCE(data_hora_triagem, data_hora_chegada)
FROM atendimento WHERE classificacao_manchester IS NOT NULL;
