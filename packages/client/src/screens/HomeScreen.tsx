import { useGameStore } from '@store';
import { PUZZLES } from '@puzzles';
import type { Puzzle } from '@model/Puzzle';
import ArcaneBackground from '@components/ArcaneBackground';

function tagModifier(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  const startPuzzle = useGameStore(s => s.startPuzzle);

  return (
    <div className='puzzle-card'>
      <div className='puzzle-card__header'>
        <h2 className='puzzle-card__title'>{puzzle.title}</h2>
        <div className='puzzle-card__tags'>
          {puzzle.context.tags.map(tag => (
            <span
              key={tag}
              className={`puzzle-card__tag puzzle-card__tag--${tagModifier(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <p className='puzzle-card__prompt'>
        {puzzle.shortDescription ??
          'This puzzle has no preview — how mysterious.'}
      </p>
      <div className='puzzle-card__footer'>
        <button
          className='puzzle-card__begin'
          onClick={() => startPuzzle(puzzle)}
        >
          <span>Begin Challenge</span>
          <span className='puzzle-card__begin-arrow'>→</span>
        </button>
      </div>
    </div>
  );
}

export function HomeScreen() {
  return (
    <div className='home-screen'>
      <ArcaneBackground />
      <div className='home-screen__hero'>
        <div className='home-screen__ornament'>✦ ✦ ✦</div>
        <h1 className='home-screen__title'>Arcantect</h1>
        <p className='home-screen__game-label'>
          The Cloud Architecture Puzzle Game
        </p>
        <p className='home-screen__subtitle'>
          Decode enchanted briefs, assemble arcane diagrams, and satisfy the
          Council of Arcantects.
        </p>
        <div className='home-screen__ornament' style={{ marginTop: '20px' }}>
          ✦ ✦ ✦
        </div>
      </div>

      <main className='home-screen__main'>
        <div className='home-screen__section-header'>
          <span className='home-screen__section-rule' />
          <h3 className='home-screen__section-title'>Challenges</h3>
          <span className='home-screen__section-rule' />
        </div>
        <div className='home-screen__puzzle-list'>
          {PUZZLES.map(puzzle => (
            <PuzzleCard key={puzzle.title} puzzle={puzzle} />
          ))}
        </div>
      </main>
    </div>
  );
}
