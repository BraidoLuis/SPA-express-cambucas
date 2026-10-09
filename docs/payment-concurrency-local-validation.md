# Validação real local — payment-concurrency-security

Executada em 08/10/2026 (America/Sao_Paulo), em PostgreSQL **17.6 nativo**, com duas conexões independentes quando aplicável. Não foi usada emulação do PostgreSQL, PGlite ou mock para os resultados abaixo.

Branch: fix/payment-concurrency-security. Base: 9bf9a02f9041b2b521de72c442ed751c1093db95.
O usuário confirmou o preflight do Supabase: colunas, enums, políticas, constraints e hashes compatíveis; duas contagens de duplicidade iguais a zero; versão 17.6. Não houve acesso remoto pelo agente. Posteriormente, o usuário informou que aplicou o SQL manual no Supabase e confirmou as funções, políticas e permissões na verificação posterior. Essa confirmação de produção não faz parte das evidências do executor local e não significa que houve nova execução de SQL nesta rodada.

## Resultado

O executor terminou com **24 verificações de nível superior aprovadas**, incluindo **sete cenários entre duas conexões reais**. O roteiro SQL contém ainda a matriz interna de estados, identidades e injeções de falha; os 24 itens não representam uma contagem de todos esses casos internos.

- payment-concurrency-apply.sql executado integralmente em transação; pós-verificação executada.
- Regressões transacionais executadas, incluindo pending/paid/cancelled/refunded com/sem recebimento, pagamento ausente, perfil inválido/sem vínculo/outra profissional, futuro/estado inelegível, repetição, conclusão sem recebimento e retorno do RPC de status.
- Zero linhas no UPDATE de atendimento/pagamento, exceção após alterar atendimento e zero linhas na auditoria abortaram integralmente atendimento, pagamento, auditoria e notificações.
- Comparação do pagamento inteiro por to_jsonb antes/depois, inclusive campos que não aparecem na interface: payment já paid foi preservado integralmente.
- UPDATE direto profissional de payments retornou zero, sem alterar amount/method/notes. UPDATE direto completed foi negado pelo teste de RLS.
- Perfil e vínculo do próprio dono inativos, e dono com papel client/admin apesar do vínculo: rejeitados pelos dois RPCs. Não apenas outra pessoa sem vínculo.
- anon e service_role não executaram os dois RPCs; authenticated conservou EXECUTE e suas validações internas.
- Reversão corrigida executada, hashes das funções originais conferidos, aplicação reaplicada e regressões/pós-verificação repetidas.

| Cenário real | Resultado |
| --- | --- |
| Admin confirmou antes da conclusão | RPC retornou payment_updated=false; todos os campos pagos foram preservados |
| Admin segurou pagamento enquanto profissional iniciou conclusão | B aguardou A; admin confirmou e commitou sem deadlock; conclusão preservou integralmente o pagamento |
| Profissional concluiu antes do UPDATE admin concorrente | UPDATE pending da admin retornou zero; metadados da profissional preservados |
| Duas conclusões simultâneas | segunda esperou e foi negada por estado; uma auditoria de conclusão |
| Cancelamento obteve lock antes da conclusão | cancelled; trigger cancelou pending; conclusão negada sem sobrescrita |
| Conclusão obteve lock antes do cancelamento | completed + paid; cancelamento negado sem sobrescrita |
| Perfil foi inativado enquanto o RPC aguardava lock | 42501 após a espera, sem efeitos no atendimento/pagamento |
| Vínculo foi inativado enquanto o RPC aguardava lock | 42501 após a espera, sem efeitos no atendimento/pagamento |

Nos sete casos simultâneos, pg_stat_activity/pg_blocking_pids confirmou wait_event_type=Lock e identificou PIDs distintos de bloqueador e bloqueado. A liberação de A ocorreu só depois dessa observação; não se usou apenas um atraso para presumir a corrida. Resultados esperados negativos retornaram P0001/42501; nenhum 40P01/deadlock, timeout ou sucesso parcial.

As evidências estruturadas, ACLs, PIDs, SQLSTATEs, timestamps UTC e hashes dos arquivos executados estão em [payment-concurrency-postgres-results.json](payment-concurrency-postgres-results.json). Os timestamps UTC de 09/10/2026 correspondem à noite de 08/10/2026 em São Paulo.

## Falhas encontradas e corrigidas

1. O bootstrap mínimo inicialmente não tinha services.category, referenciada pelo índice auditado. Acrescentada coluna de apoio; bootstrap passou a ser transacional. Isso não altera a proposta de produção.
2. A execução real do rollback encontrou **42601**: faltavam dois pontos e vírgulas depois de $function$. Corrigido payment-concurrency-rollback.sql. Depois, o rollback restaurou exatamente os fingerprints originais e a reaplicação/testes passaram.
3. O executor passou a calcular horários de fixtures anteriores aos já existentes, para repetir testes sem apagar fixtures ou colidir com a constraint de sobreposição.

Nenhuma mudança nos RPCs protegidos ou na regra comercial foi necessária depois desses testes. Nenhum arquivo de aplicação foi alterado nesta rodada. O ZIP de revisão anterior foi preservado como snapshot e contém a reversão anterior; a revisão atual deve usar os arquivos desta worktree.

## Modelo local e diferenças em relação ao Supabase

- Binários PostgreSQL 17.6 da EDB, [alternativa ZIP indicada pelo projeto PostgreSQL](https://www.postgresql.org/download/windows/), extraídos em pasta temporária. Nenhum instalador, serviço Windows, Docker/WSL ou PATH permanente foi instalado.
- Cluster C:\Users\Luis\AppData\Local\Temp\spa-payment-pg17-9637ca4ae9ee4be69a04c974110fdcc3\data; somente 127.0.0.1:54471; banco spa_payment_test; sem conexões externas.
- anon/authenticated/service_role/authenticator reproduzem os atributos relevantes da auditoria. Sessões concorrentes entram como authenticator (NOINHERIT), definem claims fictícias e SET LOCAL ROLE authenticated.
- spa_test_root é superuser apenas para bootstrap, inspeção e preparação. O owner postgres dos RPCs é **NOSUPERUSER/BYPASSRLS**, como na auditoria. RLS não foi desativada para os testes de API.
- auth.uid() lê request.jwt.claim.sub/claims. auth.users contém apenas UUIDs fictícios. Não reproduz GoTrue, assinatura/validação JWT, PostgREST, pool de conexões ou sessão real do Supabase.
- 16 funções e 18 triggers relevantes, políticas/grants das tabelas de apoio, 49 constraints e índices correspondentes foram copiados da auditoria anexada. btree_gist foi instalado localmente para a exclusão de horários. Não foram usadas migrations antigas.
- Este é um **modelo mínimo**, não dump integral. Colunas/defaults de apoio, NOT NULL, precisão numérica e nomes de tipos não expostos no anexo foram inferidos para as fixtures; não são uma nova afirmação sobre produção. Foram conservados contratos/tipos dos dois RPCs e os campos usados nos efeitos auditados. Funções originais/helpers e políticas passaram pelos guards/hashes do SQL de aplicação.
- Locale C/UTF8, timezone UTC e build Windows/MSVC diferem do Linux gerenciado. Não foram reproduzidos Storage, Realtime, extensions/grants globais e toda a topologia Supabase.
- Triggers de fila executaram SQL real e produziram notificações fictícias; não existe worker, cron, SMTP, Resend, URL ou credencial para enviá-las.
- Autenticação host trust somente no loopback temporário, com dados fictícios. Não utilizar esse cluster para dados reais.
- Servidor encerrado após os testes; diretório temporário e evidências mantidos para reprodução. Não houve alterações em dados/configurações de produção.

## Reprodução

Arquivos:
- tests/postgres/payment-local-roles.sql: papéis e banco fictício;
- tests/postgres/payment-local-bootstrap.sql: modelo e definições auditadas;
- tests/postgres/payment-local-fixtures.sql: dados sintéticos;
- tests/postgres/run-payment-postgres-tests.mjs: executor com psql e conexões reais.

Requer binários PostgreSQL 17.6 e Node já disponível no projeto. Use uma pasta nova para initdb; os scripts não devem ser usados para sobrescrever outro banco.

~~~powershell
# Executar na worktree; ajustar binários e pasta NOVA antes de começar.
$paymentBin = 'C:\caminho\pgsql\bin'
$paymentCluster = 'C:\caminho\novo-cluster-ficticio'
& "$paymentBin\initdb.exe" -D $paymentCluster -U spa_test_root --auth=trust --no-locale --encoding=UTF8
& "$paymentBin\pg_ctl.exe" start -D $paymentCluster -l "$paymentCluster\server.log" -o "-h 127.0.0.1 -p 54471" -w
& "$paymentBin\psql.exe" -X -h 127.0.0.1 -p 54471 -U spa_test_root -d postgres -v ON_ERROR_STOP=1 -f tests/postgres/payment-local-roles.sql
& "$paymentBin\psql.exe" -X -h 127.0.0.1 -p 54471 -U spa_test_root -d spa_payment_test -v ON_ERROR_STOP=1 -f tests/postgres/payment-local-bootstrap.sql
& "$paymentBin\psql.exe" -X -h 127.0.0.1 -p 54471 -U spa_test_root -d spa_payment_test -v ON_ERROR_STOP=1 -f tests/postgres/payment-local-fixtures.sql
& "$paymentBin\psql.exe" -X -h 127.0.0.1 -p 54471 -U spa_test_root -d spa_payment_test -v ON_ERROR_STOP=1 -f docs/sql/payment-concurrency-preflight.sql
& "$paymentBin\psql.exe" -X -h 127.0.0.1 -p 54471 -U spa_test_root -d spa_payment_test -v ON_ERROR_STOP=1 -f docs/sql/payment-concurrency-apply.sql
node tests/postgres/run-payment-postgres-tests.mjs "$paymentBin\psql.exe" 54471 "$paymentCluster\results"
& "$paymentBin\pg_ctl.exe" stop -D $paymentCluster -m fast -w
~~~

Verificar exit code de CADA comando; interromper se não for zero. Executar o stop em finally ao automatizar. O executor recebe binário e porta explicitamente, fixa host/banco e valida versão 17.6/owner antes dos testes; não lê .env ou credenciais. Não altera dependências.

A regressão SQL usa ROLLBACK para suas fixtures temporárias/injeções. Cenários simultâneos fazem COMMIT de dados fictícios no clone. O executor restaura a versão protegida depois de testar rollback e não limpa dados por data. Logs completos estão em C:\Users\Luis\AppData\Local\Temp\spa-payment-pg17-9637ca4ae9ee4be69a04c974110fdcc3\results-published.

## Limites e pendências

- Não comprova comportamento no schema integral Supabase, validação JWT/PostgREST, browsers, outros escritores não reproduzidos ou ambiente Linux/extensões. A aplicação manual e a verificação estrutural no Supabase foram confirmadas pelo usuário posteriormente. Continuam pendentes os fluxos manuais da aplicação via JWT/PostgREST em ambiente de teste com dados fictícios; os testes da interface da cliente com mocks passaram, sem comprovar esses contratos reais.
- Os testes de corrida foram em READ COMMITTED. Não se testaram REPEATABLE READ/SERIALIZABLE, volume/carga prolongada, restauração de backup integral ou todas as operações administrativas.
- current_professional_id, grants amplos globais, active de professionals e status inicial por INSERT permanecem pendências separadas já descritas no documento principal.
- Não foi aplicada correção em produção. Reversão de banco reabre vulnerabilidades e só deve ser considerada após revisão/autorização.
- npm run lint repetido para o novo executor: zero erros, 11 avisos preexistentes de imagens. npm test/TypeScript/build da aplicação já haviam passado; não foram repetidos nesta rodada, que não modificou a aplicação.

## Validações posteriores da aplicação

Na rodada posterior de ajustes da interface da cliente: npm test aprovou 473 testes em 19 arquivos; TypeScript, lint (zero erros, 11 avisos de imagens), build (14 páginas) e git diff --check passaram. Chromium aprovou 15 cenários em 1440/390/320 pixels; os cinco cenários de 320 pixels foram repetidos após o ajuste final. Os testes do navegador usam mocks e bloqueiam serviços reais. Nenhum teste SQL foi reaplicado em produção; o JSON de evidências preserva a execução PostgreSQL local original.
