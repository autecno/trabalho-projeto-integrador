-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: autecno
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `instructor_availability`
--

DROP TABLE IF EXISTS `instructor_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instructor_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instructor_id` int NOT NULL,
  `weekday` tinyint NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_instructor_availability_instructor_weekday` (`instructor_id`,`weekday`),
  CONSTRAINT `fk_instructor_availability_instructor` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_instructor_availability_time` CHECK ((`start_time` < `end_time`)),
  CONSTRAINT `chk_instructor_availability_weekday` CHECK ((`weekday` between 0 and 6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructor_availability`
--

LOCK TABLES `instructor_availability` WRITE;
/*!40000 ALTER TABLE `instructor_availability` DISABLE KEYS */;
/*!40000 ALTER TABLE `instructor_availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_contents`
--

DROP TABLE IF EXISTS `learning_contents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_contents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` enum('video','text') NOT NULL,
  `youtube_url` varchar(255) DEFAULT NULL,
  `summary` text,
  `body` text,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_learning_contents_module` (`module_id`),
  CONSTRAINT `fk_learning_contents_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_contents`
--

LOCK TABLES `learning_contents` WRITE;
/*!40000 ALTER TABLE `learning_contents` DISABLE KEYS */;
INSERT INTO `learning_contents` VALUES (16,1,'Sinalização e Placas Essenciais','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Principais categorias de placas e como interpretá-las.',NULL,1,1,'2026-06-18 20:20:23'),(17,1,'Regras de Circulação e Prioridade','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Ultrapassagem, preferência e circulação segura.',NULL,1,2,'2026-06-18 20:20:23'),(18,1,'Resumo para Prova Teórica','text',NULL,'Resumo objetivo da legislação.','Conheça placas, penalidades, documentos obrigatórios, preferência em cruzamentos e condutas proibidas. Priorize compreensão e não apenas memorização.',1,3,'2026-06-18 20:20:23'),(19,2,'Distância Segura e Antecipação','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Como prever riscos e dirigir com margem de segurança.',NULL,1,4,'2026-06-18 20:20:23'),(20,2,'Condução em Chuva e Baixa Visibilidade','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Técnicas básicas em condições adversas.',NULL,1,5,'2026-06-18 20:20:23'),(21,2,'Princípios da Direção Defensiva','text',NULL,'Conceitos centrais da direção defensiva.','Dirija assumindo que erros podem acontecer ao redor. Observe, antecipe, reduza riscos e mantenha distância adequada.',1,6,'2026-06-18 20:20:23'),(22,3,'Como Agir em Acidentes','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Passos iniciais antes do socorro.',NULL,1,7,'2026-06-18 20:20:23'),(23,3,'Acionamento de Emergência','video','https://www.youtube.com/watch?v=BzGp3m6DHSU','Quando e como pedir ajuda.',NULL,1,8,'2026-06-18 20:20:23'),(24,3,'Primeiros Socorros Básicos','text',NULL,'Condutas iniciais e segurança.','Proteja o local, acione emergência, não mova vítimas sem necessidade e acompanhe sinais vitais até ajuda chegar.',1,9,'2026-06-18 20:20:23');
/*!40000 ALTER TABLE `learning_contents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_modules`
--

DROP TABLE IF EXISTS `learning_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_modules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_modules`
--

LOCK TABLES `learning_modules` WRITE;
/*!40000 ALTER TABLE `learning_modules` DISABLE KEYS */;
INSERT INTO `learning_modules` VALUES (1,'Legislação de Trânsito','Regras de circulação, sinais, prioridades e leis essenciais para a prova teórica do DETRAN.',1,0,'2026-06-11 23:31:20'),(2,'Direção Defensiva','Técnicas para evitar acidentes, manter a calma no trânsito e proteger você e outras pessoas.',1,1,'2026-06-11 23:31:20'),(3,'Primeiros Socorros','Atendimento inicial em emergências, como pequenas lesões e situações de risco no trânsito.',1,2,'2026-06-11 23:31:20');
/*!40000 ALTER TABLE `learning_modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_progress`
--

DROP TABLE IF EXISTS `learning_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `content_id` int NOT NULL,
  `watched_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_learning_progress` (`user_id`,`content_id`),
  KEY `fk_learning_progress_content` (`content_id`),
  CONSTRAINT `fk_learning_progress_content` FOREIGN KEY (`content_id`) REFERENCES `learning_contents` (`id`),
  CONSTRAINT `fk_learning_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_progress`
--

LOCK TABLES `learning_progress` WRITE;
/*!40000 ALTER TABLE `learning_progress` DISABLE KEYS */;
INSERT INTO `learning_progress` VALUES (19,5,16,'2026-06-18 20:24:36'),(21,5,17,'2026-06-18 20:20:57');
/*!40000 ALTER TABLE `learning_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_quiz_questions`
--

DROP TABLE IF EXISTS `learning_quiz_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_quiz_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module_id` int NOT NULL,
  `prompt` text NOT NULL,
  `options` json NOT NULL,
  `correct_option_index` int NOT NULL,
  `explanation` text,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_learning_questions_module` (`module_id`),
  CONSTRAINT `fk_learning_questions_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_quiz_questions`
--

LOCK TABLES `learning_quiz_questions` WRITE;
/*!40000 ALTER TABLE `learning_quiz_questions` DISABLE KEYS */;
INSERT INTO `learning_quiz_questions` VALUES (16,1,'Qual placa indica parada obrigatória?','[\"Circular vermelha\", \"Octogonal vermelha\", \"Triangular amarela\", \"Retangular azul\"]',1,'A placa de parada obrigatória possui formato octogonal.',1,1,'2026-06-18 20:20:23'),(17,1,'Em cruzamento sem sinalização, a preferência é de quem vem?','[\"Esquerda\", \"Direita\", \"Mais rápido\", \"Veículo maior\"]',1,'Regra geral: preferência de quem vem pela direita.',1,2,'2026-06-18 20:20:23'),(18,1,'Ultrapassagem normalmente ocorre pela?','[\"Direita\", \"Esquerda\", \"Acostamento\", \"Qualquer lado\"]',1,'A regra geral é ultrapassar pela esquerda.',1,3,'2026-06-18 20:20:23'),(19,1,'Dirigir sem CNH é?','[\"Infração média\", \"Infração gravíssima\", \"Advertência\", \"Permitido\"]',1,'É infração gravíssima.',1,4,'2026-06-18 20:20:23'),(20,1,'Luz amarela significa?','[\"Acelerar\", \"Atenção e parar se possível\", \"Livre passagem\", \"Estacionar\"]',1,'Sinaliza atenção e preparação para parada.',1,5,'2026-06-18 20:20:23'),(21,2,'Direção defensiva busca?','[\"Chegar mais rápido\", \"Evitar acidentes\", \"Economizar combustível apenas\", \"Dirigir esportivamente\"]',1,'Objetivo principal é reduzir riscos.',1,6,'2026-06-18 20:20:23'),(22,2,'Na chuva deve-se?','[\"Aumentar velocidade\", \"Reduzir distância\", \"Reduzir velocidade\", \"Usar pisca-alerta sempre\"]',2,'Menor aderência exige redução de velocidade.',1,7,'2026-06-18 20:20:23'),(23,2,'Ponto cego é?','[\"Área invisível ao motorista\", \"Falha mecânica\", \"Luz do painel\", \"Via sem placas\"]',0,'Ponto cego reduz percepção do entorno.',1,8,'2026-06-18 20:20:23'),(24,2,'Distância segura serve para?','[\"Economia apenas\", \"Tempo de reação\", \"Menos curvas\", \"Ultrapassar\"]',1,'Mais espaço aumenta tempo de resposta.',1,9,'2026-06-18 20:20:23'),(25,2,'Ao notar condutor agressivo?','[\"Competir\", \"Ignorar regras\", \"Manter distância\", \"Frear bruscamente\"]',2,'Evitar conflito reduz risco.',1,10,'2026-06-18 20:20:23'),(26,3,'Antes de socorrer deve-se?','[\"Mover vítima\", \"Garantir segurança local\", \"Dar água\", \"Retirar capacete\"]',1,'Primeiro proteger a cena.',1,11,'2026-06-18 20:20:23'),(27,3,'Hemorragia externa leve?','[\"Compressão direta\", \"Movimentar vítima\", \"Gelo apenas\", \"Esperar\"]',0,'Compressão costuma ser medida inicial.',1,12,'2026-06-18 20:20:23'),(28,3,'Quando ligar emergência?','[\"Só se houver trânsito\", \"Quando houver necessidade médica\", \"No dia seguinte\", \"Nunca\"]',1,'Acione ajuda o quanto antes.',1,13,'2026-06-18 20:20:23'),(29,3,'Vítima inconsciente deve?','[\"Receber alimento\", \"Ser observada e socorrida\", \"Sentar\", \"Andar\"]',1,'Evite procedimentos sem preparo.',1,14,'2026-06-18 20:20:23'),(30,3,'Mover vítima é indicado?','[\"Sempre\", \"Nunca\", \"Só quando necessário para segurança\", \"Para fotografar\"]',2,'Movimentação indevida pode agravar lesões.',1,15,'2026-06-18 20:20:23');
/*!40000 ALTER TABLE `learning_quiz_questions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-18 17:27:53
