# Stack Tecnológica

## Opção Recomendada: Full Stack JavaScript

### Frontend

| Biblioteca      | Motivo                                    |
|----------------|-------------------------------------------|
| React + Vite   | ECossistema maduro, componentes, SPA     |
| Tailwind CSS   | Estilização rápida, responsivo, leve     |
| Socket.IO Client | WebSocket com fallback                   |

### Backend

| Biblioteca        | Motivo                                     |
|------------------|--------------------------------------------|
| Node.js + Express| Servidor HTTP leve                        |
| Socket.IO        | Tempo real bidirecional                   |
| SQLite (better-sqlite3) | Banco embutido, sem setup          |
| Prisma (opcional) | ORM para banco de dados                  |

## Alternativas Consideradas

### Frontend
- **Vue.js + Nuxt**: boa alternativa, mesma curva de aprendizado
- **Svelte + SvelteKit**: mais performático, mas ecossistema menor
- **Next.js**: SSR, mas para esse caso o Vite é mais simples

### Backend
- **Python + FastAPI + WebSocket**: ótimo, mas exige Python no ambiente
- **Go + Gorilla WebSocket**: performático, porém mais verboso

## Por que Node.js + Socket.IO?

1. **Mesma linguagem** no frontend e backend → facilita manutenção
2. **Socket.IO** lida com reconexão, salas e fallback automaticamente
3. **SQLite** não precisa de servidor de banco separado → ideal para uso local
4. Inicialização rápida com `npm init` e poucas dependências

## Dependências Principais

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "socket.io": "^4.7.x",
    "better-sqlite3": "^11.x",
    "cors": "^2.8.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```
