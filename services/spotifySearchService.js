import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let clientCredToken = null;
let clientCredExpiresAt = 0;

/**
 * Obtém token oficial de Client Credentials da Web API do Spotify,
 * caso o usuário tenha configurado SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env.
 */
async function getClientCredentialsToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const now = Date.now();
  if (clientCredToken && now < clientCredExpiresAt - 60000) {
    return clientCredToken;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${creds}`
        },
        timeout: 5000
      }
    );

    if (resp.data?.access_token) {
      clientCredToken = resp.data.access_token;
      clientCredExpiresAt = now + (resp.data.expires_in || 3600) * 1000;
      return clientCredToken;
    }
  } catch (err) {
    console.error('[CANVAS-API] Erro ao obter Client Credentials do Spotify:', err.response?.data || err.message);
  }

  return null;
}

/**
 * Valida se um trackId do Spotify corresponde ao título esperado usando o endpoint oEmbed público e gratuito.
 */
export async function validateTrackWithTitle(trackId, expectedTitle) {
  if (!trackId || !expectedTitle) return { valid: true };

  try {
    const resp = await axios.get(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 3000
    });

    const oembedTitle = resp.data?.title || '';
    if (!oembedTitle) return { valid: true };

    const normOembed = oembedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normExpected = expectedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matches = normOembed.includes(normExpected) || normExpected.includes(normOembed);
    return { valid: matches, actualTitle: oembedTitle };
  } catch (err) {
    // Se oEmbed falhar (offline ou timeout), não bloqueia
    return { valid: true };
  }
}

/**
 * Busca o trackId oficial do Spotify para um título e artista.
 */
export async function searchTrackOnline(title, artist) {
  let token = await getClientCredentialsToken();
  if (!token) {
    try {
      const { getToken } = await import('./spotifyAuthService.js');
      token = await getToken();
    } catch (e) {
      console.error('[CANVAS-API] Erro ao obter token do SP_DC para busca:', e?.message);
    }
  }

  if (token) {
    try {
      const q = `track:${title} artist:${artist}`.trim();
      const resp = await axios.get('https://api.spotify.com/v1/search', {
        params: { q, type: 'track', limit: 1 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 4000
      });

      const track = resp.data?.tracks?.items?.[0];
      if (track?.id) {
        console.log(`[CANVAS-API] Faixa resolvida via Spotify Web API: "${track.name}" (${track.id})`);
        return track.id;
      }
    } catch (err) {
      console.error('[CANVAS-API] Erro na busca oficial do Spotify:', err.response?.data || err.message);
    }
  }

  return null;
}

