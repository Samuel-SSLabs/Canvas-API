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
    // 1. Tenta busca via GraphQL interno do Spotify (Pathfinder - mesmo do Web Player e clients oficiais)
    try {
      const vars = {
        searchTerm: `${title} ${artist}`.trim(),
        offset: 0,
        limit: 5,
        numberOfTopResults: 5,
        includeAudiobooks: false
      };
      const exts = {
        persistedQuery: {
          version: 1,
          sha256Hash: "1d021289df50166c61630e02f002ec91182b518e56bcd681ac6b0640390c0245"
        }
      };
      const gqlUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchTracks&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(exts))}`;
      const gqlResp = await axios.get(gqlUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          'Origin': 'https://open.spotify.com',
          'Referer': 'https://open.spotify.com/'
        },
        timeout: 5000
      });

      const items = gqlResp.data?.data?.searchV2?.tracksV2?.items;
      if (Array.isArray(items) && items.length > 0) {
        const normExpected = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const it of items) {
          const trackData = it?.item?.data;
          const trackName = (trackData?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          // Garante que o título do resultado seja similar ao da faixa que está tocando
          if (normExpected.length > 2 && (trackName.includes(normExpected) || normExpected.includes(trackName))) {
            const uri = trackData?.uri || '';
            const m = uri.match(/spotify:track:([a-zA-Z0-9]{22})/);
            if (m) {
              console.log(`[CANVAS-API] Faixa resolvida via Spotify GraphQL com título validado: "${trackData?.name}" (${m[1]})`);
              return m[1];
            }
          }
        }
      }
    } catch (errGql) {
      console.warn('[CANVAS-API] Falha no GraphQL Pathfinder, tentando Web API padrão:', errGql?.message);
    }

    // 2. Fallback via Web API padrão
    try {
      const q = `track:${title} artist:${artist}`.trim();
      const resp = await axios.get('https://api.spotify.com/v1/search', {
        params: { q, type: 'track', limit: 1 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 4000
      });

      const track = resp.data?.tracks?.items?.[0];
      if (track?.id) {
        const normExpected = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const trackName = (track.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normExpected.length > 2 && (trackName.includes(normExpected) || normExpected.includes(trackName))) {
          console.log(`[CANVAS-API] Faixa resolvida via Spotify Web API: "${track.name}" (${track.id})`);
          return track.id;
        }
      }
    } catch (err) {
      console.error('[CANVAS-API] Erro na busca oficial do Spotify:', err.response?.data || err.message);
    }
  }

  return null;
}

