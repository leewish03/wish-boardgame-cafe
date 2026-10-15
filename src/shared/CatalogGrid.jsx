import React, { useState } from 'react';
import styled from 'styled-components';
import { Play } from 'lucide-react';
import { Card } from './components';
import { GameAction } from './GameSurface';
import { GAME_CATALOG } from './gameCatalog';
import { THEME } from './theme';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 24px;
  width: 100%;
  min-width: 0;
  margin-top: 18px;
  @media (max-width: 560px) { grid-template-columns: minmax(0, 1fr); gap: 16px; }
`;

const CatalogCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;
  gap: ${THEME.interaction.padding};
  h3 {
    min-height: 2.8em;
    margin: 0;
    font: 800 20px/1.4 ${THEME.font.serif};
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  p { margin: 0; font-size: ${THEME.interaction.body}; line-height: 1.5; word-break: keep-all; overflow-wrap: anywhere; }
  .catalog-meta { min-height: 3em; color: ${THEME.mutedForeground}; }
  .catalog-description { flex: 1; }
  button { margin-top: ${THEME.interaction.gap}; }
`;

const Media = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border-radius: ${THEME.radius.md};
  background: ${THEME.burgundyDeep};
  color: ${THEME.primaryForeground};
  display: grid;
  place-items: center;
  text-align: center;
  > div { padding: ${THEME.interaction.padding}; }
  strong { display: block; font: 700 20px/1.4 ${THEME.font.serif}; word-break: keep-all; }
  span { display: block; margin-top: ${THEME.interaction.gap}; font-size: ${THEME.interaction.caption}; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
`;

function Cover({ game }) {
  const [failed, setFailed] = useState(false);
  return <Media className="catalog-media" role="img" aria-label={`${game.name} ${failed ? '표지 이미지를 불러오지 못했습니다' : '게임 표지'}`}>
    <div aria-hidden="true"><strong>{game.name}</strong><span>{failed ? '이미지를 불러오지 못했습니다' : '게임 아트'}</span></div>
    {!failed && <img src={game.cover} alt="" loading="lazy" width="1536" height="1024" onError={() => setFailed(true)} />}
  </Media>;
}

export default function CatalogGrid({ onSelect, games = GAME_CATALOG }) {
  return <Grid aria-label="게임 목록">
    {Object.entries(games).map(([key, game]) => <CatalogCard as="article" key={key} aria-labelledby={`catalog-${key}`}>
      <Cover key={game.cover} game={game} />
      <h3 id={`catalog-${key}`}>{game.name}</h3>
      <p className="catalog-meta">{game.min}~{game.max}인 · {game.subtitle}</p>
      <p className="catalog-description">{game.description}</p>
      <GameAction $fullWidth onClick={(event) => onSelect(key, event)} aria-label={`${game.name} 테이블 생성`}><Play size={14} aria-hidden="true" />입장 / 테이블 생성</GameAction>
    </CatalogCard>)}
  </Grid>;
}
