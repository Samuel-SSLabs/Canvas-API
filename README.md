# Spotify Canvas API (Serverless)

Microserviço serverless de alta performance para consulta e recuperação dos vídeos em loop (**Canvas**) de faixas do Spotify, integrado ao ecossistema **Setup Deck**.

---

## 🚀 Como fazer o Deploy na Vercel (Passo a Passo)

### 1. Criar Repositório no GitHub
Suba os arquivos desta pasta para o seu repositório:
👉 [https://github.com/Samuel-SSLabs/CanvasAPI](https://github.com/Samuel-SSLabs/CanvasAPI)

> **Nota:** Certifique-se de que o `.gitignore` está ignorando `node_modules` e `.env`. A Vercel cuida de instalar tudo na nuvem.

### 2. Importar o Projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e entre com sua conta do GitHub.
2. Clique em **Add New... > Project**.
3. Selecione o repositório **Samuel-SSLabs/CanvasAPI**.
4. Em **Framework Preset**, deixe como `Other`.

### 3. Configurar a Variável de Ambiente (`SP_DC`)
1. Antes de clicar em Deploy, expanda a seção **Environment Variables**.
2. Adicione a variável:
   - **Key (Nome):** `SP_DC`
   - **Value (Valor):** `[Cole o cookie sp_dc da sua conta do Spotify]`
3. Clique em **Deploy**.

> 💡 **Como pegar o `sp_dc`:**
> Acesse [open.spotify.com](https://open.spotify.com) no navegador, abra o DevTools (**F12**) > aba **Aplicativo (Application)** > **Cookies** > selecione `https://open.spotify.com` > copie o valor do cookie chamado **`sp_dc`**.

---

## 📡 Endpoints Disponíveis

### 1. Consultar Vídeo Canvas
```http
GET /api/canvas?trackId={trackId}&title={titulo}&artist={artista}
```

**Exemplo de Resposta (200 OK):**
```json
{
  "canvasesList": [
    {
      "id": "32b57cbf354b453a95eee32bb04d4e42",
      "canvasUrl": "https://canvaz.scdn.co/upload/licensor/5bSw7fRotCnRCcO9br14W5/video/32b57cbf354b453a95eee32bb04d4e42.cnvs.mp4",
      "trackUri": "spotify:track:3OHfY25tqY28d16oZczHc8"
    }
  ],
  "trackId": "3OHfY25tqY28d16oZczHc8"
}
```

### 2. Status do Serviço
```http
GET /health
```
Retorna `{ "status": "ok", "service": "Spotify-Canvas-API", "env": "vercel" }`.

---

## ⚡ Recursos e Otimizações

- **Edge CDN Caching:** Respostas de faixas já consultadas são cacheadas na borda da Vercel (`Cache-Control: s-maxage=86400`), respondendo em ~15ms sem reconsultar o Spotify.
- **Zero Configuração no Desktop:** Usuários do Setup Deck não precisam instalar dependências ou informar cookies de sessão.
- **Tolerância a Falhas:** Retornos vazios (`canvasesList: []`) permitem fallback suave para capas de álbum estáticas no display.
---