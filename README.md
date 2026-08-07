# SPA Express Cambucás

Frontend preparado para desenvolvimento local e deploy automático na Vercel.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Testar o build de produção

```bash
npm run build
npm start
```

## Publicar na Vercel

1. Crie um repositório no GitHub e envie esta pasta.
2. Entre na Vercel e clique em **Add New > Project**.
3. Importe o repositório.
4. A Vercel detectará o framework **Next.js** automaticamente.
5. Mantenha o Build Command como `next build` e publique.

Depois da integração, cada push na branch `main` publica uma nova versão em produção. Outras branches geram previews separados.

## Situação atual

O login, cadastro, serviços e agendamentos ainda são demonstrativos e executados no frontend. O próximo passo é integrar uma API Node.js com PostgreSQL, Prisma e Docker.
