import { useGameStore } from '@store';
import ArcaneBackground from '@components/ArcaneBackground';
import type { TradeoffDimension, TradeoffProfile, TradeoffWeights } from '@arcantect/scorer';

const DIMENSION_LABELS: Record<TradeoffDimension, string> = {
  latency: 'Latency',
  cost: 'Cost',
  complexity: 'Complexity',
  operability: 'Operability',
  throughput: 'Throughput',
  security: 'Security',
  consistency: 'Consistency',
  blastRadius: 'Blast Radius',
};

function StarDisplay({ stars }: { stars: 1 | 2 | 3 }) {
  return (
    <div className='results-screen__stars'>
      {([1, 2, 3] as const).map(n => (
        <span
          key={n}
          className={`results-screen__star ${n <= stars ? 'results-screen__star--filled' : 'results-screen__star--empty'}`}
          aria-hidden='true'
        >
          ★
        </span>
      ))}
    </div>
  );
}

function TradeoffRadar({
  profile,
  weights,
}: {
  profile: TradeoffProfile;
  weights: TradeoffWeights;
}) {
  const weightedDims = (Object.entries(weights) as [TradeoffDimension, number][]).filter(
    ([, w]) => w > 0,
  );
  if (weightedDims.length === 0) return null;

  const maxAbs = Math.max(
    4,
    ...weightedDims.map(([dim]) => Math.abs(profile[dim])),
  );
  const barWidth = 120;

  return (
    <div className='results-screen__section'>
      <div className='results-screen__section-title'>Tradeoff Profile</div>
      <div className='results-screen__tradeoff-radar'>
        {weightedDims.map(([dim, w]) => {
          const value = profile[dim];
          const pct = (value / maxAbs) * 100;
          const positive = value >= 0;
          return (
            <div key={dim} className='results-screen__tradeoff-row'>
              <span className='results-screen__tradeoff-label'>
                {DIMENSION_LABELS[dim]}
                {w > 1 && <span className='results-screen__tradeoff-weight'> ×{w}</span>}
              </span>
              <div
                className='results-screen__tradeoff-track'
                style={{ width: barWidth }}
                aria-label={`${DIMENSION_LABELS[dim]}: ${value}`}
              >
                <div className='results-screen__tradeoff-zero' />
                {value !== 0 && (
                  <div
                    className={`results-screen__tradeoff-bar results-screen__tradeoff-bar--${positive ? 'positive' : 'negative'}`}
                    style={{
                      width: `${Math.abs(pct) / 2}%`,
                      left: positive ? '50%' : `${50 - Math.abs(pct) / 2}%`,
                    }}
                  />
                )}
              </div>
              <span
                className={`results-screen__tradeoff-value ${positive ? 'results-screen__tradeoff-value--positive' : 'results-screen__tradeoff-value--negative'}`}
              >
                {value > 0 ? `+${value}` : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function verdictConfig(stars: 1 | 2 | 3, passed: boolean) {
  if (!passed) {
    return {
      modifier: 'failed',
      heading: 'The Council of Arcantects rejects your design.',
    } as const;
  }
  if (stars === 3) {
    return {
      modifier: 'perfect',
      heading: 'The Council grants you the Seal of Mastery.',
    } as const;
  }
  if (stars === 2) {
    return {
      modifier: 'passed',
      heading: 'Your design is sanctioned by the Council.',
    } as const;
  }
  return {
    modifier: 'passed',
    heading: 'Your design is sanctioned by the Council.',
  } as const;
}

function retryLabel(stars: 1 | 2 | 3, passed: boolean): string {
  if (!passed) return 'Try Again';
  if (stars === 3) return 'Try a Different Approach';
  if (stars === 2) return 'Optimise Design';
  return 'Try Again';
}

export function ResultsScreen() {
  const puzzle = useGameStore(s => s.puzzle);
  const scoreResult = useGameStore(s => s.scoreResult);
  const nodes = useGameStore(s => s.nodes);
  const edges = useGameStore(s => s.edges);
  const goHome = useGameStore(s => s.goHome);
  const retryPuzzle = useGameStore(s => s.retryPuzzle);

  if (!puzzle || !scoreResult) return null;

  const { hardConstraintResults, capabilityResults, tradeoffProfile, restrictionResults, violations, passed, stars } = scoreResult;

  const metCount = hardConstraintResults.filter(r => r.passed).length;
  const totalCount = hardConstraintResults.length;
  const verdict = verdictConfig(stars, passed);

  const rubricWeights = (puzzle.rubric.tradeoffWeights ?? {}) as TradeoffWeights;
  const hasTradeoffWeights = Object.values(rubricWeights).some(w => (w ?? 0) > 0);
  const rubricHasOptimization =
    'optimization' in puzzle.rubric && puzzle.rubric.optimization != null;

  return (
    <div className='results-screen'>
      <ArcaneBackground />
      <div className='results-screen__card'>
        <div className='results-screen__ornament'>✦ ✦ ✦</div>
        <h2 className='results-screen__heading'>The Council's Verdict</h2>
        <div className='results-screen__puzzle-title'>{puzzle.title}</div>

        <div
          className={`results-screen__verdict results-screen__verdict--${verdict.modifier}`}
        >
          <StarDisplay stars={passed ? stars : 1} />
          <span className='results-screen__verdict-text'>
            {verdict.heading}
          </span>
        </div>

        <div className='results-screen__req-count'>
          <strong>{metCount}</strong>
          <span className='results-screen__req-count__total'>
            {' '}
            of {totalCount}
          </span>{' '}
          constraints met
        </div>

        {passed && stars < 3 && rubricHasOptimization && (
          <div className='results-screen__optimization-hint'>
            {nodes.length} runes, {edges.length} bindings used — a leaner
            design earns the Seal of Mastery.
          </div>
        )}

        {stars === 3 && (
          <div className='results-screen__optimization-proof'>
            {nodes.length} runes · {edges.length} bindings
          </div>
        )}

        <div className='results-screen__section'>
          <div className='results-screen__section-title'>Constraints</div>
          <ul className='results-screen__list'>
            {hardConstraintResults.map(req => (
              <li
                key={req.id}
                className={`results-screen__item ${
                  req.passed ? 'results-screen__item--passed' : ''
                }`}
              >
                <span className='results-screen__marker' aria-hidden='true'>
                  {req.passed ? '✓' : '○'}
                </span>
                <span className='results-screen__hint'>
                  {req.hint}
                  {req.bonus && (
                    <span className='results-screen__bonus'>Bonus</span>
                  )}
                </span>
                <span className='results-screen__item-status'>
                  {req.passed ? 'Met' : 'Open'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {capabilityResults.length > 0 && (
          <div className='results-screen__section'>
            <div className='results-screen__section-title'>Capabilities</div>
            <ul className='results-screen__list'>
              {capabilityResults.map(cap => (
                <li
                  key={cap.id}
                  className={`results-screen__item ${
                    cap.passed ? 'results-screen__item--passed' : ''
                  }`}
                >
                  <span className='results-screen__marker' aria-hidden='true'>
                    {cap.passed ? '✓' : '○'}
                  </span>
                  <span className='results-screen__hint'>{cap.hint}</span>
                  <span className='results-screen__item-status'>
                    {cap.passed ? 'Met' : 'Open'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {restrictionResults.length > 0 && (
          <div className='results-screen__section'>
            <div className='results-screen__section-title'>Restrictions</div>
            <ul className='results-screen__list'>
              {restrictionResults.map(r => (
                <li
                  key={r.id}
                  className={`results-screen__item ${
                    r.passed ? 'results-screen__item--passed' : 'results-screen__item--violation'
                  }`}
                >
                  <span className='results-screen__marker' aria-hidden='true'>
                    {r.passed ? '✓' : '✗'}
                  </span>
                  <span className='results-screen__hint'>{r.hint}</span>
                  <span className='results-screen__item-status'>
                    {r.passed ? 'Held' : 'Violated'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {violations.length > 0 && (
          <div className='results-screen__section'>
            <div className='results-screen__section-title'>Violations</div>
            <ul className='results-screen__list'>
              {violations.map((v, i) => (
                <li
                  key={i}
                  className='results-screen__item results-screen__item--violation'
                >
                  <span className='results-screen__marker' aria-hidden='true'>
                    ✗
                  </span>
                  <span className='results-screen__hint'>{v.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasTradeoffWeights && (
          <TradeoffRadar profile={tradeoffProfile} weights={rubricWeights} />
        )}

        <div className='results-screen__actions'>
          <button
            className='results-screen__btn results-screen__btn--secondary'
            onClick={goHome}
          >
            Give Up
          </button>
          <button
            className='results-screen__btn results-screen__btn--primary'
            onClick={retryPuzzle}
          >
            <span>{retryLabel(stars, passed)}</span>
          </button>
        </div>
        <div className='results-screen__ornament' style={{ marginTop: '4px' }}>
          ✦ ✦ ✦
        </div>
      </div>
    </div>
  );
}
