## 📝 Descrição

Esta PR implementa a funcionalidade completa de **Simulado Teórico** para alunos, permitindo que realizem simulados com questões de múltipla escolha e recebam feedback detalhado sobre seu desempenho.

## 🎯 User Story

**Como** aluno
**Quero** fazer simulado teórico
**Para** me preparar para prova

## ✅ Checklist de Implementação

### Acesso ao Simulado
- [x] Apenas usuários autenticados com `discriminator = 'student'` podem acessar
- [x] Existe uma tela dedicada para o simulado (`/learning/[moduleId]/quiz`)
- [x] Botão "Iniciar prova" disponível na página do módulo
- [x] Middleware de autenticação valida token JWT

### Estrutura da Prova
- [x] Simulado contém questões de múltipla escolha
- [x] Cada questão possui enunciado + 4 alternativas
- [x] Sistema valida que apenas 1 alternativa é correta
- [x] Questões mockadas no banco de dados para inicial

### Execução do Simulado
- [x] Aluno pode selecionar uma alternativa por questão
- [x] Sistema permite navegação livre entre questões
- [x] Respostas são armazenadas durante a execução
- [x] Aluno pode finalizar a qualquer momento (após responder todas)

### Resultado da Prova
- [x] Total de acertos exibido
- [x] Total de erros exibido
- [x] Percentual de aproveitamento calculado e exibido
- [x] Indicação de respostas corretas/incorretas
- [x] Explicações exibidas (se disponível)
- [x] Status de aprovação (70%) indicado

### Regras de Negócio
- [x] Apenas usuários `role: 'student'` podem acessar
- [x] Não é possível alterar respostas após finalizar (respostas immutáveis)
- [x] Sistema valida integridade das respostas no backend

## 🏗️ Arquitetura

### Backend
**Novos Arquivos:**
- `backend/src/routes/quiz.route.ts` - Rotas de quiz dedicadas
- `backend/src/routes/quiz.route.test.ts` - Testes de rotas

**Rotas Implementadas:**
```
GET  /quiz/modules/:moduleId/start      → Inicia simulado (retorna questões)
POST /quiz/modules/:moduleId/submit     → Submete respostas (avalia e retorna resultado)
```

**Modificações:**
- `backend/src/app.ts` - Registração de novas rotas

### Frontend
**Novos Arquivos:**
- `frontend/src/components/ui/modal.tsx` - Componente Modal reutilizável
- `frontend/src/components/quiz/quiz-component.tsx` - Lógica completa do quiz
- `frontend/src/components/quiz/quiz-component.test.ts` - Testes do componente
- `frontend/src/app/(private)/learning/[moduleId]/quiz/page.tsx` - Página dedicada

**Modificações:**
- `frontend/src/app/(private)/learning/[moduleId]/page.tsx` - Adição de botão "Iniciar prova"

## 🧪 Testes

### Backend Tests
```bash
cd backend
npm test -- src/routes/quiz.route.test.ts
```

✅ Testes implementados:
- GET /quiz/modules/:moduleId/start retorna questões
- POST /quiz/modules/:moduleId/submit avalia respostas corretamente
- 403 Forbidden para usuários não-estudantes
- Validação de formato de respostas

### Frontend Tests
```bash
cd frontend
npm test -- quiz-component.test.ts
```

✅ Testes implementados:
- Inicialização do simulado
- Verificação de role de estudante
- Estrutura de questões (4 alternativas)
- Seleção de alternativas
- Navegação entre questões
- Cálculo de resultados
- Controle de acesso

## 🚀 Como Testar

### Fluxo Completo
1. **Iniciar ambiente:**
   ```bash
   docker compose up --build -d
   ```

2. **Login como aluno:**
   - Acesse: http://localhost:3000/auth/login
   - Use credenciais de estudante

3. **Acessar simulado:**
   - Vá para: http://localhost:3000/learning
   - Clique em um módulo
   - Clique em "Iniciar Prova"

4. **Realizar simulado:**
   - Responda todas as questões
   - Use botões "Anterior/Próxima" para navegar
   - Clique "Finalizar Prova"

5. **Ver resultado:**
   - Visualize acertos, erros e percentual
   - Veja feedback detalhado por questão

## 📊 Dados e Mocagem

O simulado utiliza questões mockadas no banco de dados:
- 5 questões por módulo (configurável)
- 4 alternativas por questão
- 1 alternativa correta por questão
- Explicações opcionais

## 🔒 Segurança

- ✅ JWT authentication via middleware
- ✅ Role validation (apenas 'student')
- ✅ Input validation no backend
- ✅ Avaliação no servidor (não no cliente)
- ✅ Sem possibilidade de alterar respostas após submit

## 📝 Documentação

- [FEATURE_SIMULADO.md](./FEATURE_SIMULADO.md) - Documentação completa da funcionalidade
- [AGENTS.md](./AGENTS.md) - Instruções para agentes AI
- Testes: `src/**/*.test.ts`

## 🎨 Interface

### Página do Módulo (modificada)
- Novo card "Simulado do módulo"
- Botão "Iniciar Prova" em destaque

### Página do Quiz (nova)
- Tela de instrução inicial
- Interface limpa para responder questões
- Progresso visual com barra
- Navegação intuitiva

### Tela de Resultados (nova)
- Cards com métricas principais (acertos, erros, %)
- Indicação de aprovação (verde se ≥70%)
- Detalhamento de cada questão
- Destaque de respostas corretas/incorretas
- Explicações por questão

## 🔗 Branch e PR

- **Branch:** `feature/simulado-teorico`
- **Base:** `main` (ou branch principal do projeto)
- **Commits:** 1 commit com implementação completa

## 📦 Mudanças de Arquivos

```
 M  backend/src/app.ts
 A  backend/src/routes/quiz.route.ts
 A  backend/src/routes/quiz.route.test.ts
 A  FEATURE_SIMULADO.md
 M  frontend/src/app/(private)/learning/[moduleId]/page.tsx
 A  frontend/src/app/(private)/learning/[moduleId]/quiz/page.tsx
 A  frontend/src/components/quiz/quiz-component.tsx
 A  frontend/src/components/quiz/quiz-component.test.ts
 A  frontend/src/components/ui/modal.tsx
```

## 🎓 Critérios de Aceitação Finais

- [x] Aluno consegue iniciar simulado via botão "Iniciar prova"
- [x] Sistema exibe questões corretamente
- [x] Aluno consegue navegar entre questões
- [x] Aluno consegue selecionar alternativas
- [x] Aluno consegue finalizar o simulado
- [x] Resultado é exibido corretamente
- [x] Sistema calcula acertos, erros e percentual
- [x] Sistema indica aprovação/reprovação
- [x] Nenhum erro no fluxo completo
- [x] Regras de acesso funcionando corretamente
- [x] Apenas estudantes conseguem acessar

## 🤝 Merging

Esta PR está pronta para merge após:
1. ✅ Code review
2. ✅ Testes passando
3. ✅ Verificação em ambiente local
4. ✅ Aprovação da equipe

## 📞 Contato

Em caso de dúvidas ou sugestões, favor comentar nesta PR.

---

**Status:** ✅ Pronto para Review
