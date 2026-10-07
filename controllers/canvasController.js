import { getCanvases } from '../services/spotifyCanvasService.js';
import { validateTrackWithTitle, searchTrackOnline } from '../services/spotifySearchService.js';

export const fetchCanvas = async (req, res) => {
  let { trackId, title, artist } = req.query;

  if (!trackId && (!title || !artist)) {
    console.log('[CANVAS-API] Erro: parâmetro trackId ou (title e artist) ausentes na requisição.');
    return res.status(400).json({ error: 'Missing trackId or (title and artist) parameters' });
  }

  // Se trackId foi fornecido e também o título, valida via oEmbed para evitar IDs obsoletos
  if (trackId && title) {
    const val = await validateTrackWithTitle(trackId, title);
    if (!val.valid) {
      console.log(`[CANVAS-API] Aviso: Track ID "${trackId}" pertence a "${val.actualTitle}", mas a faixa tocando é "${title}". Descartando ID inválido.`);
      trackId = null;
    }
  }

  // Se não temos trackId válido (ou se o ID local foi descartado), busca online por título e artista
  if (!trackId && title && artist) {
    const buscadoId = await searchTrackOnline(title, artist);
    if (buscadoId) {
      trackId = buscadoId;
    } else {
      console.log(`[CANVAS-API] Track ID ausente e busca indisponível para "${title}" - "${artist}".`);
      return res.status(200).json({ canvasesList: [], trackId: null, message: 'Faixa sem Canvas correspondente.' });
    }
  }

  if (!trackId) {
    return res.status(200).json({ canvasesList: [], trackId: null, message: 'Nenhum trackId válido.' });
  }

  console.log(`[CANVAS-API] Buscando Canvas para trackId: ${trackId} ("${title || ''}")`);
  try {
    const canvasData = await getCanvases(`spotify:track:${trackId}`);
    if (canvasData === null) {
      console.log(`[CANVAS-API] Erro ao autenticar no Spotify. Verifique o cookie SP_DC.`);
      return res.status(401).json({ error: 'auth_failed', message: 'Falha de autenticação com o Spotify (SP_DC inválido ou expirado)' });
    }

    if (!canvasData.canvasesList || canvasData.canvasesList.length === 0) {
      console.log(`[CANVAS-API] A faixa "${title || trackId}" (${trackId}) não possui vídeo Canvas no Spotify.`);
      res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=21600');
      return res.status(200).json({ canvasesList: [], trackId });
    }

    const videoUrl = canvasData.canvasesList[0]?.canvasUrl;
    console.log(`[CANVAS-API] Canvas encontrado com sucesso: ${videoUrl}`);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
    res.json({ ...canvasData, trackId });
  } catch (err) {
    console.error(`[CANVAS-API] Exceção ao buscar canvas para ${trackId}:`, err?.message || err);
    res.status(500).json({ error: err?.message || 'Erro interno' });
  }
};