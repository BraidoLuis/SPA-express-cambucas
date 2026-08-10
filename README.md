# SPA Express Cambucás

Frontend em Next.js, React e TypeScript, organizado por domínio e preparado para Vercel, Supabase, Resend e WhatsApp Business Cloud API.

## Requisitos

- Node.js 20.9 ou superior
- Um projeto no Supabase
- Conta no Resend para e-mails transacionais
- Aplicativo configurado na Meta para WhatsApp Business Cloud API

## Rodar localmente

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Estrutura

```text
app/
  api/
    cron/media-cleanup/          limpeza das mídias vencidas
    notifications/              Resend e WhatsApp
  components/
    admin/                       painel geral
    auth/                        login e cadastro
    client/                      catálogo, agenda e perfil da cliente
    professional/                agenda e serviços das profissionais
    public/                      página pública
    shared/                      componentes reutilizáveis
  lib/
    services/                    serviços da aplicação
    validations/                 validações de formulários
lib/supabase/                    clientes Supabase de navegador e servidor
public/                          imagens
supabase/migrations/             banco completo e políticas RLS
```

## Configurar o Supabase

1. Crie um projeto novo no Supabase.
2. Abra `SQL Editor` e execute todo o arquivo `supabase/migrations/001_full_setup.sql`.
3. Em `Authentication > URL Configuration`, informe a URL da Vercel e `http://localhost:3000` durante o desenvolvimento.
4. Em `Authentication > Providers > Email`, defina se o cadastro exigirá confirmação por e-mail.
5. Copie a Project URL, a chave pública e a chave `service_role` para `.env.local`.
6. Crie as contas da administradora, Eliane e Dayanne pelo Auth.
7. No fim do SQL existem comandos comentados para promover os usuários e criar os registros das profissionais.

O SQL cria:

- perfis e papéis `client`, `professional` e `admin`;
- profissionais e serviços;
- vínculo de serviços por profissional, com preço e duração personalizados;
- disponibilidade semanal, exceções e bloqueios;
- agendamentos sem sobreposição, respeitando a duração real;
- validação contra agendamentos passados feitos por clientes;
- atendimentos externos adicionados pela profissional;
- pagamentos confirmados manualmente;
- mídia de serviços com validade de 14 dias;
- preferências e fila de notificações;
- histórico de auditoria;
- bucket do Storage e políticas RLS completas.

## Resend

1. Verifique um domínio no Resend.
2. Crie uma API Key.
3. Preencha `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.

A rota `app/api/notifications/appointment/route.ts` envia a confirmação para a cliente e para a profissional conforme as preferências armazenadas no Supabase.

## WhatsApp Business

Configure na Meta os templates abaixo, em português do Brasil:

- `appointment_confirmation`: nome da cliente, serviço, profissional e data/hora;
- `professional_new_appointment`: nome da profissional, cliente, serviço e data/hora.

Depois preencha o token, o Phone Number ID e a versão da Graph API no arquivo de ambiente.

## Limpeza automática das mídias

A rota `/api/cron/media-cleanup` exclui do Storage e do banco as mídias com mais de 14 dias. O `vercel.json` agenda a execução diária. Defina `CRON_SECRET` nas variáveis da Vercel.

## Deploy na Vercel

1. Envie a pasta para um repositório GitHub.
2. Importe o repositório na Vercel.
3. O preset deve ser reconhecido como Next.js e o Root Directory deve permanecer `./`.
4. Cadastre todas as variáveis do `.env.example`.
5. Faça o deploy.

## Observação importante

O layout e os fluxos demonstrativos estão prontos. O cadastro já possui o serviço de integração com o Supabase. Ao desenvolver o backend definitivo, substitua os dados demonstrativos de `app/lib/spa-data.ts` por consultas às tabelas, mantendo os componentes e as regras SQL deste pacote.
