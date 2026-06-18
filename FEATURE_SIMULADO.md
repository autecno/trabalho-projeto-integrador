# Funcionalidade: Simulado Teórico

## 📋 Descrição

Implementação completa de um sistema de simulado teórico com questões de múltipla escolha para auxiliar alunos na preparação para provas. A funcionalidade inclui uma interface dedicada para realização do simulado, cálculo automático de resultados e feedback detalhado.

## 🎯 User Story

**Como** aluno
**Quero** fazer simulado teórico
**Para** me preparar para prova

### Critérios de Aceitação

✅ **Acesso ao simulado**
- Apenas usuários autenticados com `discriminator = 'student'` podem acessar
- Existe uma tela dedicada para o simulado
- O aluno pode iniciar um novo simulado com o botão "Iniciar prova"

✅ **Estrutura da prova**
- O simulado contém questões de múltipla escolha
- Cada questão possui:
  - Enunciado
  - Pelo menos 4 alternativas
  - Apenas 1 alternativa correta
  - Questões mockadas inicialmente

✅ **Execução do simulado**
- O aluno pode selecionar uma alternativa por questão
- O sistema permite navegação entre questões
- As respostas são armazenadas durante a execução
- O aluno pode finalizar o simulado a qualquer momento

✅ **Resultado da prova**
- Ao finalizar, o sistema exibe:
  - Total de acertos
  - Total de erros
  - Percentual de aproveitamento
  - Indicação de quais respostas estão corretas/incorretas

✅ **Regras de negócio**
- Apenas usuários do tipo `student` podem realizar simulados
- Não é possível alterar respostas após finalizar
- O sistema valida integridade das respostas

## 🏗️ Arquitetura da Solução

### Backend

#### Nova Rota: Quiz Routes (`src/routes/quiz.route.ts`)

```typescript
// GET /quiz/modules/:moduleId/start
// Retorna as questões do módulo para iniciar um novo simulado
// Requer autenticação e role de estudante

// POST /quiz/modules/:moduleId/submit
// Avalia as respostas e retorna resultado com scores
// Requer autenticação e role de estudante
```

#### Integração com App
- Registrada em `app.ts` junto com outras rotas
- Usa middleware de autenticação existente
- Valida role de estudante automaticamente

#### Testes Backend (`src/routes/quiz.route.test.ts`)
- ✅ GET /quiz/modules/:moduleId/start retorna questões
- ✅ POST /quiz/modules/:moduleId/submit avalia respostas
- ✅ 403 para usuários não-estudantes
- ✅ Validação de formato de respostas

### Frontend

#### Nova Página: Quiz Page (`src/app/(private)/learning/[moduleId]/quiz/page.tsx`)
- Tela dedicada com interface intuitiva
- Tela de instrução inicial
- Componente de quiz interativo
- Exibição de resultados detalhados

#### Novos Componentes

1. **Modal Component** (`src/components/ui/modal.tsx`)
   - Componente reutilizável de modal/diálogo
   - Suporte para diferentes tamanhos
   - Header com botão de fechar
   - Footer customizável

2. **Quiz Component** (`src/components/quiz/quiz-component.tsx`)
   - Lógica completa do quiz
   - Navegação entre questões
   - Seleção de alternativas
   - Armazenamento de respostas
   - Exibição de resultados detalhados
   - Cálculo de percentual e status de aprovação (70%)

#### Modificação de Página Existente
- **Learning Module Page** (`src/app/(private)/learning/[moduleId]/page.tsx`)
  - Substituição da interface inline do quiz
  - Adição de botão "Iniciar prova"
  - Link para página dedicada de quiz

#### Testes Frontend (`src/components/quiz/quiz-component.test.ts`)
- ✅ Inicialização do simulado
- ✅ Verificação de role de estudante
- ✅ Estrutura de questões
- ✅ Seleção de alternativas
- ✅ Navegação entre questões
- ✅ Cálculo de resultados
- ✅ Controle de acesso

## 📁 Estrutura de Arquivos

```
Backend:
├── src/routes/
│   ├── quiz.route.ts ✨ (nova)
│   └── quiz.route.test.ts ✨ (novo)
├── src/app.ts (modificado - import da rota)

Frontend:
├── src/app/(private)/learning/[moduleId]/
│   ├── page.tsx (modificado - botão "Iniciar prova")
│   └── quiz/ ✨ (novo)
│       └── page.tsx ✨ (nova página dedicada)
├── src/components/
│   ├── ui/
│   │   └── modal.tsx ✨ (novo)
│   └── quiz/ ✨ (nova pasta)
│       ├── quiz-component.tsx ✨ (novo)
│       └── quiz-component.test.ts ✨ (novo)
```

## 🔄 Fluxo de Uso

1. **Aluno acessa módulo de aprendizado**
   - Vê conteúdos e opção de simulado na sidebar

2. **Clica em "Iniciar prova"**
   - Redirecionado para página dedicada de quiz
   - `/learning/[moduleId]/quiz`

3. **Na tela de quiz**
   - Vê instrução com informações gerais
   - Clica "Iniciar prova" para começar

4. **Durante o simulado**
   - Vê questão com 4 alternativas
   - Pode navegar para anterior/próxima
   - Todas as questões devem ser respondidas
   - Progresso visual na barra de progresso

5. **Após finalizar**
   - Sistema envia respostas para backend
   - Backend calcula resultado
   - Frontend exibe:
     - Total de acertos/erros
     - Percentual de acertos
     - Status de aprovação (70%)
     - Resultado detalhado de cada questão
     - Indicação de respostas corretas/incorretas
     - Explicações (se disponível)

## 🔒 Segurança

- **Autenticação**: Middleware JWT existente valida token
- **Autorização**: Apenas users com `role: 'student'` e `discriminator: 'student'`
- **Validação**: Formato de respostas validado no backend
- **Integridade**: Respostas avaliadas no backend (não no cliente)

## 📊 Modelo de Dados

### Request: POST /quiz/modules/:moduleId/submit
```json
{
  "answers": [
    { "questionId": 1, "selectedOptionIndex": 2 },
    { "questionId": 2, "selectedOptionIndex": 0 }
  ]
}
```

### Response: POST /quiz/modules/:moduleId/submit
```json
{
  "moduleId": 1,
  "totalQuestions": 5,
  "correctAnswers": 4,
  "wrongAnswers": 1,
  "percentageCorrect": 80,
  "passed": true,
  "results": [
    {
      "questionId": 1,
      "isCorrect": true,
      "selectedOptionIndex": 2,
      "correctOptionIndex": 2,
      "explanation": "..."
    }
  ]
}
```

## 🧪 Testes

### Backend
```bash
cd backend
npm test -- src/routes/quiz.route.test.ts
```

### Frontend
```bash
cd frontend
npm test -- quiz-component.test.ts
```

## 🚀 Como Testar Localmente

1. **Iniciar ambiente Docker**
```bash
docker compose up --build -d
```

2. **Acessar a aplicação**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

3. **Fluxo de teste**
   - Login como aluno (student)
   - Acesse um módulo com conteúdo
   - Clique em "Iniciar prova"
   - Responda todas as questões
   - Veja o resultado

## 📝 Notas de Implementação

- As questões são atualmente **mockadas** no banco de dados
- O sistema está pronto para migração para dados reais
- A nota de corte é **70%** para aprovação (configurável)
- Suporta explicações customizadas por questão
- Interface responsiva e acessível

## 🔮 Melhorias Futuras

- [ ] Persistência de histórico de simulados
- [ ] Análise de desempenho por tipo de questão
- [ ] Sugestões de conteúdo com base em erros
- [ ] Simulados adaptativos (dificuldade dinâmica)
- [ ] Export de resultados em PDF
- [ ] Comparação com resultados anteriores
- [ ] Dashboard de progresso

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação de arquitetura: `docs/descricao_sistema.md`
- Instruções de design: `instrucoes_design.md`
- Testes: `src/**/*.test.ts`
