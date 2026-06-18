# CI/CD com GitHub Actions

O workflow principal esta em `.github/workflows/ci-cd.yml`.

## Fluxo de branches

1. Desenvolvedores trabalham em suas branches individuais.
2. O merge para `teste` ou `testes` dispara a validacao automatica.
3. Se a validacao passar, o GitHub Actions faz merge para `production`.
4. O commit em `production` serve como gatilho para os deploys automaticos da Vercel e da Railway.
5. Depois disso, o GitHub Actions sincroniza `production` de volta para `main`.

Pull requests apontando para `teste` ou `testes` rodam apenas a validacao, sem promover para `production`.

## Segredos necessarios

Configure estes secrets em `Settings > Secrets and variables > Actions`:

- `CI_PUSH_TOKEN`: token da conta que deve fazer os pushes do workflow.
- `CI_GIT_USER_NAME`: nome que aparecera como autor dos commits.
- `CI_GIT_USER_EMAIL`: e-mail que aparecera como autor dos commits.

O token precisa ter permissao de escrita no repositorio. Se `production` ou `main` tiverem regras de protecao, permita que essa conta ou o GitHub Actions consiga fazer push/merge nessas branches.

## Validacao atual

O workflow executa testes automatizados antes de promover qualquer alteracao para `production`. Atualmente ele roda:

- `npm test` em `backend`.
- `npm test` em `frontend`.
- `npm run lint` em `frontend`.
- `npm run build` em `frontend`.

Quando novos testes forem adicionados, basta manter os scripts `test` dos projetos atualizados.
